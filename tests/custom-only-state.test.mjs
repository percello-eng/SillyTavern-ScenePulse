// Regression: disabled built-ins in historical snapshots must not re-enter
// the canonical state or the next generation's previous-state context.
import assert from 'node:assert/strict';

const snapshots = {
    59: {
        location: 'Balcony', present: ['Councillor'], activity: 'Council meeting',
        physicalstate: '', activeobjects: [], activethreads: [],
        time: '19:10:00', sceneMood: 'Tense', sceneTension: 'moderate',
        sceneSummary: 'The council discusses the dispute.', characters: [],
    },
};
const customKeys = ['location', 'present', 'activity', 'physicalstate', 'activeobjects', 'activethreads'];
let context = {
    name1: 'Player', name2: 'Character', groups: [], characters: [], groupId: null,
    chatMetadata: { scenepulse: { snapshots } },
    extensionSettings: { scenepulse: {
        enabled: true, profiles: [{ id: 'working', name: 'Working - current',
            panels: { dashboard: false, scene: false, quests: false,
                relationships: false, characters: false, storyIdeas: false },
            customPanels: [{ name: 'Current State', enabled: true,
                fields: customKeys.map(key => ({ key, type: ['present', 'activeobjects', 'activethreads'].includes(key) ? 'list' : 'text' })) }],
        }], activeProfileId: 'working',
    } },
    saveMetadata() {}, saveSettingsDebounced() {},
};
globalThis.SillyTavern = { getContext: () => context };
globalThis.toastr = { warning() {}, error() {} };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };

const { getActiveSchema } = await import('../src/settings.js');
const { normalizeTracker } = await import('../src/normalize.js');
const { projectActiveState } = await import('../src/active-state.js');
const { detectStagnation } = await import('../src/stagnation.js');
const { scenePulseInterceptor } = await import('../src/generation/interceptor.js');
const { generateTracker } = await import('../src/generation/engine.js');

const activeSchema = getActiveSchema().value;
assert.deepEqual(Object.keys(activeSchema.properties), customKeys);
assert.deepEqual(projectActiveState(snapshots[59], activeSchema),
    Object.fromEntries(customKeys.map(key => [key, snapshots[59][key]])));

const next = normalizeTracker({
    location: 'Healing tent > Courtyard', present: ['Healer'],
    activity: 'Treatment', physicalstate: 'Bandaged arm',
    activeobjects: ['Bandage'], activethreads: ['Recover'],
}, activeSchema);
assert.deepEqual(Object.keys(next), customKeys);
assert.equal(next.location, 'Healing tent > Courtyard');
assert.equal(next.sceneSummary, undefined);
assert.equal(next.sceneTension, undefined);
assert.equal(next.time, undefined);
assert.equal(next.characters, undefined);

// Even four stored historical snapshots containing the synthetic moderate
// value cannot trigger stagnation while sceneTension is disabled.
for (let i = 60; i <= 62; i++) snapshots[i] = { ...snapshots[59] };
assert.equal(detectStagnation(), null);

// Separate mode also embeds a snapshot in the RP prompt. Legacy disabled
// values must not reach that model, even before the next tracker update.
context.extensionSettings.scenepulse.injectionMethod = 'separate';
context.extensionSettings.scenepulse.embedSnapshots = 1;
const chat = [{ is_user: true, mes: 'Continue.' }];
await scenePulseInterceptor(chat, {}, null, 'normal');
assert.equal(chat.length, 2);
assert.match(chat[0].mes, /Healing|Balcony/);
assert.doesNotMatch(chat[0].mes, /sceneSummary|sceneTension|Council discusses|characters/);

// Exercise generateTracker itself. A fatal fake API response stops before
// persistence, while capturing the exact prompt sent in Separate mode.
let trackerPrompt;
context.chatId = 'fixture-chat';
context.characterId = 0;
context.characters = [{ avatar: 'Character.png', name: 'Character' }];
context.chat = [{ is_user: false, name: 'Character', mes: 'The healer opens the tent.', send_date: 'fixture-date', swipe_id: 0 }];
context.generateQuietPrompt = async ({ quietPrompt }) => {
    trackerPrompt = quietPrompt;
    throw new Error('401 fixture stops before save');
};
await generateTracker(0);
assert.ok(trackerPrompt, 'Separate tracker request was made');
const previousState = trackerPrompt.split('PREVIOUS STATE (for reference')[1]?.split('Generate updated JSON.')[0];
assert.ok(previousState, 'Separate tracker prompt contains previous state');
assert.match(previousState, /"location": "Balcony"/);
assert.doesNotMatch(previousState, /sceneSummary|sceneTension|sceneMood|"characters"|Council discusses/);
assert.doesNotMatch(previousState, /Quest Journal|EMPTY characters|NEVER drop unresolved quests/);

// Built-in time tracking retains both temporal validation signals even
// though the dynamic output schema lists neither companion field.
const timeSchema = { properties: { time: {}, location: {} } };
assert.deepEqual(projectActiveState({ time: '19:10:00', elapsed: '2m',
    temporalIntent: 'flashback', location: 'Tent', sceneTension: 'moderate' }, timeSchema),
{ time: '19:10:00', location: 'Tent', elapsed: '2m', temporalIntent: 'flashback' });
const timed = normalizeTracker({ time: '19:10:00', elapsed: '2m',
    temporalIntent: 'flashback', location: 'Tent' }, timeSchema);
assert.equal(timed.elapsed, '2m');
assert.equal(timed.temporalIntent, 'flashback');

// A partial built-in profile with topic disabled must not infer a topic
// stagnation warning from the empty placeholder values.
const profile = context.extensionSettings.scenepulse.profiles[0];
profile.panels = { dashboard: false, scene: true, quests: false,
    relationships: false, characters: false, storyIdeas: false };
profile.fieldToggles = { sceneTopic: false };
for (let i = 59; i <= 62; i++) snapshots[i] = {
    sceneTension: ['low', 'high', 'moderate', 'critical'][i - 59],
    sceneMood: ['Quiet', 'Tense', 'Relieved', 'Urgent'][i - 59],
    sceneTopic: 'Old synthetic topic',
};
assert.equal(Object.hasOwn(getActiveSchema().value.properties, 'sceneTopic'), false);
assert.equal(detectStagnation(), null);

// Normal built-in profile retains the existing normalization behavior.
const builtIn = normalizeTracker({ location: 'New room', sceneTension: 'high' });
assert.equal(builtIn.sceneTension, 'high');
console.log('custom-only state boundaries: passed');
