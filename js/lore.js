// THE NINTH HOUR — narrative data, cast, town layout, lore.
// All persons, places and organizations are fictional.

export const GAME_TITLE = 'THE NINTH HOUR';

export const TOWN = {
  name: 'Mercy Falls',
  county: 'Calder County',
  population: 4312,
  founded: 1887,
  tagline: 'A town that keeps its promises.',
};

/* ------------------------------------------------------------------ */
/*  TOWN LAYOUT — shared by 3D world, simulation and paper map         */
/* ------------------------------------------------------------------ */
// x / z are world metres. Door side is where the entrance gap sits.
export const LOCATIONS = {
  precinct:   { name: 'Mercy Falls Police Department', short: 'Precinct', x: 22, z: -30, w: 24, d: 18, h: 7.2, kind: 'police',    color: '#8fa3a6', door: 'south', interior: true,  spot: [22, -34] },
  chapel:     { name: 'Chapel of the Ninth Hour',      short: 'Chapel',   x: -34, z: -34, w: 22, d: 20, h: 9.5, kind: 'chapel',   color: '#9c8f74', door: 'south', interior: true,  spot: [-34, -30] },
  library:    { name: 'Mercy Falls Library & Archive', short: 'Library',  x: -32, z: 26, w: 22, d: 16, h: 6.5, kind: 'library',   color: '#8b8a78', door: 'south', interior: true,  spot: [-32, 30] },
  diner:      { name: 'The Copper Kettle',             short: 'Diner',    x: -18, z: 44, w: 13, d: 11, h: 4.8, kind: 'diner',     color: '#a67a58', door: 'south', interior: true,  spot: [-18, 46] },
  hospital:   { name: 'Mercy General Hospital',        short: 'Hospital', x: 34, z: 24, w: 26, d: 18, h: 8.4, kind: 'hospital',  color: '#9ba4a2', door: 'south', interior: true,  spot: [34, 28] },
  bar:        { name: 'The Anchor',                    short: 'The Anchor', x: 46, z: 44, w: 13, d: 11, h: 4.8, kind: 'bar',     color: '#7c6b58', door: 'south', interior: true,  spot: [46, 46] },
  motel:      { name: 'Blue Spruce Motel',             short: 'Motel',    x: 82, z: 22, w: 20, d: 16, h: 5.4, kind: 'motel',     color: '#8d7c62', door: 'south', interior: true,  spot: [82, 25] },
  townhall:   { name: 'Mercy Falls Town Hall',         short: 'Town Hall',x: 16, z: -14, w: 16, d: 10, h: 7.0, kind: 'civic',     color: '#8e8f83', door: 'south', interior: false, spot: [16, -9] },
  foundry:    { name: 'Vane Foundry',                  short: 'Foundry',  x: -84, z: 26, w: 34, d: 28, h: 11, kind: 'industrial', color: '#5f625c', door: 'east',  interior: true,  spot: [-84, 26] },
  warehouse:  { name: 'Rail Depot Warehouse',          short: 'Warehouse',x: 82, z: -74, w: 28, d: 20, h: 9, kind: 'industrial', color: '#5c5f59', door: 'south', interior: true,  spot: [82, -72] },
  victimHome: { name: 'Holt Residence',                short: 'Holt Home',x: 48, z: 80, w: 12, d: 11, h: 4.6, kind: 'house',     color: '#7f7264', door: 'south', interior: true,  spot: [48, 82] },
  apartment:  { name: 'Rook Residence',                short: 'Your Apartment', x: 76, z: 44, w: 12, d: 10, h: 5.0, kind: 'house', color: '#6e7066', door: 'south', interior: true, spot: [76, 46] },
  cemetery:   { name: 'Mercy Falls Cemetery',          short: 'Cemetery', x: -82, z: -80, w: 34, d: 26, h: 0, kind: 'cemetery', color: '#59615a', interior: false, spot: [-82, -76] },
  riverbank:  { name: 'Mill River Bank',               short: 'Riverbank',x: 36, z: 96, w: 26, d: 16, h: 0, kind: 'river',    color: '#435c60', interior: false, spot: [36, 96] },
  school:     { name: 'Mercy Falls High School',       short: 'School',   x: -84, z: -14, w: 26, d: 18, h: 8, kind: 'school',    color: '#8a8171', interior: false, spot: [-84, -12] },
  church:     { name: "St. Brendan's Catholic Church", short: "St. Brendan's", x: 40, z: -84, w: 20, d: 16, h: 10, kind: 'church', color: '#8d8474', interior: false, spot: [40, -83] },
  firehouse:  { name: 'Mercy Falls Fire Station',      short: 'Fire Station', x: 16, z: 46, w: 14, d: 10, h: 6, kind: 'civic', color: '#8a5e50', interior: false, spot: [16, 48] },
  hardware:   { name: 'Bell & Sons Hardware',          short: 'Hardware', x: 18, z: -68, w: 12, d: 10, h: 5, kind: 'shop', color: '#7c6a54', interior: false, spot: [18, -66] },
  supermarket:{ name: 'Falls Market',                  short: 'Market',   x: 82, z: -40, w: 18, d: 12, h: 5.5, kind: 'shop', color: '#86816f', interior: false, spot: [82, -38] },
  chapelBasement: { name: 'Chapel Undercroft', short: 'Undercroft', x: -34, z: -34, w: 20, d: 18, h: 3.6, kind: 'crypt', color: '#4c4a42', interior: true, spot: [-34, -34], under: true },
};

export const SCENE_ANCHORS = [
  { id: 'foundry',  loc: 'foundry',  pos: [-84, 0, 27],  angle: 0.3, label: 'Vane Foundry' },
  { id: 'cemetery', loc: 'cemetery', pos: [-82, 0, -80], angle: 1.2, label: 'Mercy Falls Cemetery' },
  { id: 'riverbank',loc: 'riverbank',pos: [36, 0, 96],   angle: 2.1, label: 'Mill River Bank' },
  { id: 'warehouse',loc: 'warehouse',pos: [82, 0, -72],  angle: 0.7, label: 'Rail Depot Warehouse' },
  { id: 'basement', loc: 'chapelBasement', pos: [-34, -3.2, -34], angle: 0.9, label: 'Chapel Undercroft' },
];

export const KEY_PLACES = [
  { id: 'precinct', label: 'Mercy Falls P.D.', icon: 'police' },
  { id: 'chapel', label: 'Chapel of the Ninth Hour', icon: 'chapel' },
  { id: 'library', label: 'Library & Archive', icon: 'library' },
  { id: 'hospital', label: 'Mercy General Hospital', icon: 'hospital' },
  { id: 'diner', label: 'The Copper Kettle', icon: 'diner' },
  { id: 'bar', label: 'The Anchor', icon: 'bar' },
  { id: 'motel', label: 'Blue Spruce Motel', icon: 'motel' },
  { id: 'foundry', label: 'Vane Foundry', icon: 'scene' },
  { id: 'cemetery', label: 'Mercy Falls Cemetery', icon: 'scene' },
  { id: 'warehouse', label: 'Rail Depot Warehouse', icon: 'scene' },
  { id: 'riverbank', label: 'Mill River Bank', icon: 'scene' },
  { id: 'victimHome', label: 'Holt Residence', icon: 'home' },
];

/* ------------------------------------------------------------------ */
/*  VICTIMS                                                            */
/* ------------------------------------------------------------------ */
export const VICTIM_TEMPLATES = [
  {
    id: 'maren', name: 'Maren Holt', age: 27, job: 'Night nurse, Mercy General',
    home: 'Holt Residence', link: 'Her brother Simon vanished nine months ago. She had been asking questions about the chapel.',
    epithet: 'The Foundry Girl', hair: 'dark auburn', eyes: 'hazel',
    detail: 'A silver St. Brendan\'s medal was placed in her mouth. She had stopped wearing it years ago.',
    nextOfKin: 'Her mother, Alma Holt, lives at the Blue Spruce Motel, room 2.',
  },
  {
    id: 'deacon', name: 'Elias Ward', age: 41, job: 'Church deacon and tax preparer',
    home: 'Bell & Sons Hardware', link: 'He kept the chapel\'s accounts for twenty years and had recently stopped attending services.',
    epithet: 'The Deacon', hair: 'grey', eyes: 'pale blue',
    detail: 'His tongue was removed with a surgical incision. A page from the Ledger was folded into his breast pocket.',
    nextOfKin: 'His wife, Doris Ward, teaches at Mercy Falls High.',
  },
  {
    id: 'songbird', name: 'Cora Lin', age: 22, job: 'Singer, The Anchor',
    home: 'Blue Spruce Motel', link: 'She was born at 3:09 a.m. — the ninth hour. The congregation calls such people "marked."',
    epithet: 'The Songbird', hair: 'black', eyes: 'brown',
    detail: 'Nine candle stubs were arranged around her. She was found with her hands folded, as if in prayer.',
    nextOfKin: 'Her roommate, June Harlow, works at the Copper Kettle.',
  },
];

/* ------------------------------------------------------------------ */
/*  KEY CAST                                                           */
/* ------------------------------------------------------------------ */
// fiber / ash / shoe / hand / handwriting are the identifying traits used
// by the forensic loop. Only the Hand's set appears in physical evidence.
export const CAST = [
  {
    id: 'silas', name: 'Father Silas Crane', short: 'Fr. Crane', age: 52, sex: 'm',
    role: 'Shepherd of the Ninth Hour', job: 'Clergy', workplace: 'chapel', home: 'chapel',
    color: 0x191a19, accent: 0xcfc4a8, skin: 0xc59d7d, hair: 0xb9b3a6, build: 1.0,
    traits: { hand: 'right', shoe: 10.5, fiber: 'black wool / cassock', ash: 'myrrh & birch incense', handwrite: 'cramped, high loops' },
    alibi: 'Heard confessions in the chapel until eleven, then locked up and walked home alone.',
    alibiWitness: 'jonah', alibiTruth: true, alibiWeak: false,
    sect: 'Orthodox · Shepherd', public: true, suspect: true,
    secret: 'He has been altering the Ledger for years to protect the Rourke family. He believes the Hand is an impostor.',
    motive: 'Preserve the congregation and the covenant, whatever it costs.',
    greeting: 'The chapel is open to anyone, Detective. Even to those who carry a badge and a question.',
    victimTalk: 'Maren came to vespers. She asked about the ninth candle and the names beneath the altar. I told her some doors are kept shut for a reason.',
    sectTalk: 'We are not a cult. We are a congregation of people who remember what this town was built on. The Lamb asks only that we remember.',
    pressure: 'You are confusing faith with guilt, Detective. They have never been the same thing.',
    asylum: 'Do you know what a town does when it stops believing in anything? It becomes a very quiet place to die.',
  },
  {
    id: 'edith', name: 'Dr. Edith Vale', short: 'Dr. Vale', age: 44, sex: 'f',
    role: 'Medical examiner, Mercy General', job: 'Medical examiner', workplace: 'hospital', home: 'hospital',
    color: 0x2c3436, accent: 0xa9c0be, skin: 0xcaa487, hair: 0x3a2b24, build: 0.95,
    traits: { hand: 'left', shoe: 8, fiber: 'blue cotton / surgical scrubs', ash: 'clove cigarette ash', handwrite: 'slanted medical shorthand' },
    alibi: 'On shift in the morgue until two a.m. She signed three autopsy reports that night.',
    alibiWitness: 'dana', alibiTruth: true, alibiWeak: false,
    sect: 'Reformist · Keeper of the Ledger', public: true, suspect: true,
    secret: 'She has been quietly falsifying cause of death on sect-linked deaths for a decade. She is trying to stop the Reaping.',
    motive: 'End the covenant without destroying the town.',
    greeting: 'Detective. I was wondering when you would come down. The dead are more patient than the living.',
    victimTalk: 'Maren was healthy. No defensive wounds. She knew her killer, or she had stopped wanting to run. The incision was post-mortem.',
    sectTalk: 'The Ninth Hour is a story old men tell to frighten children into church. The trouble is that some of us began to believe the ending.',
    pressure: 'I have seen what people do to each other with clean hands. A badge does not make you clean.',
    asylum: 'If you find something in the Ledger that cannot be explained, bring it to me before you bring it to anyone else.',
  },
  {
    id: 'jonah', name: 'Jonah Pike', short: 'Jonah', age: 38, sex: 'm',
    role: 'Groundskeeper, Mercy Falls Cemetery', job: 'Groundskeeper', workplace: 'cemetery', home: 'cemetery',
    color: 0x3c3a2b, accent: 0x9c7a4e, skin: 0xbd9270, hair: 0x211a14, build: 1.1,
    traits: { hand: 'left', shoe: 11, fiber: 'oiled canvas / work coat', ash: 'roll-your-own tobacco', handwrite: 'block capitals' },
    alibi: 'Drinking at The Anchor until close, then walked the cemetery rounds.',
    alibiWitness: 'tomas', alibiTruth: true, alibiWeak: false,
    sect: 'Awakened · Gravekeeper', public: false, suspect: true,
    secret: 'He digs the unmarked graves for the sect and has been counting the new ones. He is terrified, not guilty.',
    motive: 'Survive the season and keep his daughter out of the Ledger.',
    greeting: 'Grounds are closed after dark. Unless you are here to bury something. Are you here to bury something?',
    victimTalk: 'I dig the holes. I do not fill them. There is a difference, and God knows I have explained it to Him.',
    sectTalk: 'They say the Lamb is patient. I have been digging for it since I was nineteen. Patience is what you call it when you are not allowed to scream.',
    pressure: 'You keep looking at my hands. Everyone looks at my hands. I dig graves, Detective. That is all they are for.',
    asylum: 'There is a grave in the north row with no name and fresh flowers. I did not put them there.',
  },
  {
    id: 'caleb', name: 'Caleb Rourke', short: 'Mr. Rourke', age: 47, sex: 'm',
    role: 'Councilman; owner, Vane Foundry', job: 'Councilman', workplace: 'townhall', home: 'foundry',
    color: 0x2b2b2e, accent: 0xb49a6a, skin: 0xc6a183, hair: 0x6b5a45, build: 1.02,
    traits: { hand: 'right', shoe: 11.5, fiber: 'camel hair / overcoat', ash: 'cedar cigar ash', handwrite: 'broad, underlined' },
    alibi: 'City council meeting until ten. His driver took him straight home.',
    alibiWitness: 'ellis', alibiTruth: true, alibiWeak: false,
    sect: 'Orthodox · Benefactor', public: true, suspect: true,
    secret: 'He funds the chapel and knows the Reaping is real. His grandfather was one of the nine miners. He believes his family owes the debt.',
    motive: 'Keep the town alive. Keep the ledger balanced.',
    greeting: 'Detective Vale. I heard they gave you the Foundry case. I own the Foundry. I hope that is not awkward.',
    victimTalk: 'I did not know the girl. I know her mother. I know most mothers in this town. It is the price of sitting on the council.',
    sectTalk: 'Faith is a civic institution, like a fire department. You do not have to believe in the fire to pay for the truck.',
    pressure: 'Careful. This town has a long memory, and I sign its paychecks. Figuratively speaking.',
    asylum: 'My grandfather died in the collapse. Six days underground. They say he came back different. They say a lot of things.',
  },
  {
    id: 'isaac', name: 'Isaac Bell', short: 'Isaac', age: 33, sex: 'm',
    role: 'Owner, Bell & Sons Hardware', job: 'Shopkeeper', workplace: 'hardware', home: 'hardware',
    color: 0x2f2a24, accent: 0x8f6b43, skin: 0xc09a7a, hair: 0x2a2118, build: 0.98,
    traits: { hand: 'left', shoe: 10, fiber: 'brown cotton / shop apron', ash: 'sweet pipe tobacco', handwrite: 'tiny, precise' },
    alibi: 'Closed the shop at nine and went home. He lives alone. No witness.',
    alibiWitness: 'alma', alibiTruth: true, alibiWeak: true,
    sect: 'Awakened · Provisioner', public: false, suspect: true,
    secret: 'He supplies the chapel with candles, rope and lime. He knows what the supplies are for and has started leaving the back door unlocked for the police.',
    motive: 'Be caught before he has to do it again.',
    greeting: 'Shop is closed. You can come back at eight. Or you can tell me what you need and I will pretend I am not afraid of you.',
    victimTalk: 'She bought a flashlight here. Two weeks ago. Said she was going into the undercroft. I sold it to her. I should have said no.',
    sectTalk: 'I light the candles. I do not ask what they are for. That is how you stay alive in a town like this.',
    pressure: 'You want me to say a name. I have a name. I am not going to give it to you for free.',
    asylum: 'He left the door open for you. Do not make him regret it.',
  },

  // Non-suspect cast
  {
    id: 'june', name: 'June Harlow', short: 'June', age: 24, sex: 'f',
    role: 'Waitress, The Copper Kettle', job: 'Waitress', workplace: 'diner', home: 'diner',
    color: 0x3d2f2b, accent: 0xc7a16a, skin: 0xcda183, hair: 0x6e3928, build: 0.9,
    traits: { hand: 'right', shoe: 7, fiber: 'polyester / diner uniform', ash: 'menthol cigarette ash', handwrite: 'round, hurried' },
    alibi: 'She was closing the diner with Tomas until 2 a.m.', alibiWitness: 'tomas', alibiTruth: true, alibiWeak: false,
    sect: 'None · lapsed', public: true, suspect: false, witness: true,
    secret: 'She saw a figure in a long coat washing blood from his hands in the diner sink at 4 a.m. She is too frightened to say who.',
    motive: 'Keep her job, keep her head down, keep her little brother out of the chapel.',
    greeting: 'Coffee? You look like you need the kind that comes with a straw.',
    victimTalk: 'Maren came in every Tuesday. She was looking into her brother. I told her to stop. I told her twice.',
    sectTalk: 'They come in after service, all smiles, and they never order anything with meat. It gives me the creeps.',
    pressure: 'I already told you what I saw. Do not make me say it again.',
    witnessLine: 'It was four in the morning. The back door was open. He was washing his hands. There was blood in the sink, and he was humming.',
    asylum: 'I saw his coat. I saw his shoes. I am not going to say his name in this town.',
  },
  {
    id: 'lena', name: 'Lena Marsh', short: 'Lena', age: 29, sex: 'f',
    role: 'Reporter, Mercy Falls Herald', job: 'Journalist', workplace: 'diner', home: 'diner',
    color: 0x242c2c, accent: 0x9a7b52, skin: 0xc9a287, hair: 0x1c1a18, build: 0.93,
    traits: { hand: 'right', shoe: 8, fiber: 'tweed / blazer', ash: 'no trace', handwrite: 'angular print' },
    alibi: 'Working late at the Herald office.', alibiWitness: 'ruth', alibiTruth: true, alibiWeak: false,
    sect: 'None · investigating', public: true, suspect: false, witness: false,
    secret: 'She has a folder of missing-person clippings going back forty years. She wants a career-making story more than she wants to be careful.',
    motive: 'Publish the truth before someone else buries it.',
    greeting: 'Detective. You have that look. The one that means the official story is already falling apart.',
    victimTalk: 'Maren came to me three weeks ago. She said the chapel keeps two sets of books. I thought she was paranoid. I was wrong.',
    sectTalk: 'The Ninth Hour owns half the council, the hospital board, the cemetery. You cannot arrest a town.',
    pressure: 'Off the record or on? Choose carefully, Detective. I have a deadline and very few morals.',
    asylum: 'There are nine names in the 1889 census that do not appear in the 1890 census. Nine. The same number as the miners.',
  },
  {
    id: 'mercer', name: 'Captain Owen Mercer', short: 'Captain', age: 58, sex: 'm',
    role: 'Captain, Homicide Division', job: 'Police captain', workplace: 'precinct', home: 'precinct',
    color: 0x232b2d, accent: 0x8d9a96, skin: 0xbe9a7e, hair: 0x8b8881, build: 1.05,
    traits: { hand: 'right', shoe: 10.5, fiber: 'navy wool / uniform', ash: 'cigarette ash', handwrite: 'cramped print' },
    alibi: 'At the precinct all night. Half the department can confirm it.', alibiWitness: 'dana', alibiTruth: true, alibiWeak: false,
    sect: 'Compromised · knows', public: true, suspect: false, witness: false,
    secret: 'He has been suppressing the missing-person files at the request of the congregation. He is not the killer, but he is complicit.',
    motive: 'Keep the town calm and his pension intact.',
    greeting: 'Vale. The mayor called me twice before breakfast. Tell me you have something that is not a feeling.',
    victimTalk: 'Maren Holt. Twenty-seven. Nurse. No priors, no enemies, no boyfriend worth mentioning. The kind of victim that makes the papers nervous.',
    sectTalk: 'I do not discuss church with officers. I do not discuss anything with officers that I would not put in a report.',
    pressure: 'You are one bad headline away from a desk in the basement, Detective.',
    asylum: 'There is a file in the evidence room with my signature on it. I want you to understand I did not have a choice.',
  },
  {
    id: 'ruth', name: 'Ruth Calder', short: 'Ruth', age: 70, sex: 'f',
    role: 'Archivist, Mercy Falls Library', job: 'Archivist', workplace: 'library', home: 'library',
    color: 0x3b3a32, accent: 0xb09a6f, skin: 0xc6a78d, hair: 0xd1cbbd, build: 0.88,
    traits: { hand: 'right', shoe: 7.5, fiber: 'grey wool / cardigan', ash: 'no trace', handwrite: 'copperplate' },
    alibi: 'At the library until nine, cataloguing.', alibiWitness: 'lena', alibiTruth: true, alibiWeak: false,
    sect: 'Keeper of records · sympathetic', public: true, suspect: false, witness: false,
    secret: 'She has the 1889 miner diary and the original Vane letters. She has been waiting decades for someone to ask.',
    motive: 'Make sure the record survives, even if the town does not.',
    greeting: 'Shh. Not because of the rules. Because the shelves are listening.',
    victimTalk: 'That girl sat at the back table for three weeks. She read the same nine pages over and over. I should have given her the diary.',
    sectTalk: 'The congregation did not invent the story, Detective. They found it in the ground, the way you find a stone in a field.',
    pressure: 'I have spent forty years being careful. Do not mistake careful for afraid.',
    asylum: 'The mine did not collapse by accident. Ask the Rourkes. Ask what they were digging toward.',
    archiveLine: 'The Vane diary. 1889. He wrote that the ninth miner was never found. The other eight were arranged in a circle. He called it a "return."',
  },
  {
    id: 'tomas', name: 'Tomas Vane', short: 'Tomas', age: 49, sex: 'm',
    role: 'Bartender, The Anchor', job: 'Bartender', workplace: 'bar', home: 'bar',
    color: 0x302b26, accent: 0x9a7b57, skin: 0xb98c6c, hair: 0x161310, build: 1.0,
    traits: { hand: 'right', shoe: 9.5, fiber: 'cotton / shirt', ash: 'cigarette ash', handwrite: 'loose print' },
    alibi: 'He was behind the bar until two.', alibiWitness: 'june', alibiTruth: true, alibiWeak: false,
    sect: 'Lapsed · cousin of the Vane line', public: false, suspect: false, witness: false,
    secret: 'He is descended from Elias Vane and knows the family stories. He waters the whiskey and has a soft spot for lost people.',
    motive: 'Last call, every night, for everyone.',
    greeting: 'You look like a whiskey man. I will not tell anyone if you order the coffee.',
    victimTalk: 'Maren? She was in here asking about her brother. I told her the truth: people leave Mercy Falls all the time. They just do not always use the road.',
    sectTalk: 'My family started that church. Does not mean I go. Some inheritances you leave in a drawer.',
    pressure: 'You are asking the wrong Vane, Detective. I only pour the drinks.',
    asylum: 'Elias Vane did not survive because God loved him. He survived because he was the only one who did what had to be done.',
    witnessLine: 'Jonah Pike? He was here until close. He always is. Left around two, the same as always. Whatever you are looking for, it is not him.',
  },
  {
    id: 'dana', name: 'Dana Reyes', short: 'Nurse Reyes', age: 31, sex: 'f',
    role: 'Night nurse, Mercy General', job: 'Nurse', workplace: 'hospital', home: 'hospital',
    color: 0x2f383a, accent: 0x9db5b0, skin: 0xbf9275, hair: 0x241a16, build: 0.92,
    traits: { hand: 'left', shoe: 8.5, fiber: 'blue cotton / scrubs', ash: 'no trace', handwrite: 'rounded print' },
    alibi: 'On the night ward.', alibiWitness: 'edith', alibiTruth: true, alibiWeak: false,
    sect: 'Believer · peripheral', public: false, suspect: false, witness: false,
    secret: 'She stole a vial of morphine for her mother and is terrified of losing her job. She traded shifts with Maren the night she died.',
    motive: 'Keep her mother comfortable and her license clean.',
    greeting: 'Visiting hours ended at eight. I can make an exception for the police. I cannot make one for the dead.',
    victimTalk: 'Maren was the best of us. She took my Sunday shift and I never even thanked her properly. I keep thinking I will see her in the break room.',
    sectTalk: 'I light a candle sometimes. That is not the same as belonging. Is it?',
    pressure: 'I did not sign anything I should not have. I am a nurse. I follow the chart.',
    asylum: 'Dr. Vale signed three reports that night. Three. I remember because I brought her coffee and she did not drink it.',
    witnessLine: 'Dr. Vale was in the morgue until two. I brought her coffee at midnight. She was elbow-deep in a John Doe. She did not leave.',
  },
  {
    id: 'ellis', name: 'Ellis Ward', short: 'Ellis', age: 63, sex: 'm',
    role: 'Council driver; Rourke family driver', job: 'Driver', workplace: 'townhall', home: 'townhall',
    color: 0x27292a, accent: 0x827a64, skin: 0xad8a6e, hair: 0x77736a, build: 1.0,
    traits: { hand: 'right', shoe: 9.5, fiber: 'grey wool / livery', ash: 'cigarette ash', handwrite: 'block print' },
    alibi: 'Drove Councilman Rourke home at ten and parked the car.', alibiWitness: 'ruth', alibiTruth: true, alibiWeak: false,
    sect: 'None · employed by the family', public: false, suspect: false, witness: false,
    secret: 'He drives the councilman everywhere and sees everything. He is loyal until he is not.',
    motive: 'A pension and a quiet retirement.',
    greeting: 'Car is outside. Mr. Rourke is in a meeting. You can wait in the hall like the rest of the town.',
    victimTalk: 'I did not know her. I know the streets. That is my job.',
    sectTalk: 'I drive. I do not pray. The councilman does enough for both of us.',
    pressure: 'I am sixty-three years old, Detective. I cannot afford to remember something that did not happen.',
    asylum: 'The councilman keeps a second phone in the glovebox. It rings on the same night every month.',
    witnessLine: 'Mr. Rourke? Meeting ended at ten. I drove him straight home. He was in the house by half past. I waited until the lights went out.',
  },
  {
    id: 'alma', name: 'Alma Holt', short: 'Alma', age: 68, sex: 'f',
    role: 'Maren\'s mother; motel resident', job: 'Retired', workplace: 'motel', home: 'motel',
    color: 0x353029, accent: 0x9e8b6b, skin: 0xc3a188, hair: 0xc7c0b3, build: 0.85,
    traits: { hand: 'right', shoe: 7, fiber: 'flannel / robe', ash: 'no trace', handwrite: 'trembling cursive' },
    alibi: 'She was at the motel, sedated.', alibiWitness: 'nell', alibiTruth: true, alibiWeak: false,
    sect: 'None · grieving', public: false, suspect: false, witness: true,
    secret: 'She knew Maren was investigating the chapel and begged her to stop. She has Maren\'s notebook.',
    motive: 'Understand why her daughter is dead.',
    greeting: 'You are the detective. They said you would come. They always say someone will come.',
    victimTalk: 'My girl was born at 4:12 in the morning. Not the ninth hour. I checked. I checked after they started saying it meant something.',
    sectTalk: 'I sewed the altar cloth for thirty years. I never asked about the door under the floor. I should have.',
    pressure: 'Do not ask me to be brave. I have used all of it up.',
    witnessLine: 'Isaac Bell? His light was off by nine. I can see his back window from mine. But I did not see him leave. I did not see him at all.',
  },
  {
    id: 'nell', name: 'Nell Grady', short: 'Nell', age: 56, sex: 'f',
    role: 'Manager, Blue Spruce Motel', job: 'Motel manager', workplace: 'motel', home: 'motel',
    color: 0x3a342d, accent: 0xa08a68, skin: 0xbf9c81, hair: 0x8f6f4d, build: 0.96,
    traits: { hand: 'right', shoe: 8.5, fiber: 'polyester / blazer', ash: 'cigarette ash', handwrite: 'round print' },
    alibi: 'Front desk until eleven.', alibiWitness: 'alma', alibiTruth: true, alibiWeak: false,
    sect: 'None · minded her own business', public: false, suspect: false, witness: false,
    secret: 'She rents room 9 to someone who pays cash and never signs the register. She has not looked inside.',
    motive: 'Fill the rooms and avoid the police.',
    greeting: 'Room 2 is paid through Friday. The ice machine is broken. The chapel choir practices on Thursdays, so you will want the back rooms.',
    victimTalk: 'The Holt girl? Quiet. Paid cash. Left at odd hours. I thought she was a nurse. Nurses keep odd hours.',
    sectTalk: 'The congregation books the conference room for "retreats." They tip well and they do not make a mess.',
    pressure: 'I run a motel. I do not run a confessional.',
    asylum: 'Room 9. Paid in cash. I have not seen the guest in three days. The key is still on the hook.',
    witnessLine: 'Alma was at the motel all evening. I gave her tea and a sedative at nine. She did not leave her room.',
  },
  {
    id: 'doris', name: 'Doris Ward', short: 'Doris', age: 46, sex: 'f',
    role: 'Teacher, Mercy Falls High', job: 'Teacher', workplace: 'school', home: 'school',
    color: 0x39342e, accent: 0x9e8b6a, skin: 0xc9a98d, hair: 0x5c4633, build: 0.94,
    traits: { hand: 'right', shoe: 8, fiber: 'tweed / skirt', ash: 'no trace', handwrite: 'neat cursive' },
    alibi: 'At home grading papers.', alibiWitness: 'ellis', alibiTruth: true, alibiWeak: false,
    sect: 'Believer · choir', public: false, suspect: false, witness: false,
    secret: 'She knows her husband Elias Ward was on the Ledger and that someone in the congregation marked him.',
    motive: 'Protect her students from what happened to her husband.',
    greeting: 'The school is closed, Detective. Unless you are here about a student. Please do not tell me you are here about a student.',
    victimTalk: 'I did not know Maren. I know her mother. We sing in the same choir. We sing about mercy. It is a difficult word to hold.',
    sectTalk: 'I believe in the congregation. I do not believe in what some of the men have made of it. There is a difference.',
    pressure: 'You are asking a teacher to choose between the truth and her job. That is not a fair question.',
    asylum: 'My husband kept a list of the nine. He was afraid of a man with a long coat. He wrote "the Hand is not chosen. He volunteers."',
    witnessLine: 'The meeting ended at ten. Ellis drove Caleb home. I saw the car from my window. They did not come back until morning.',
  },
  {
    id: 'simon', name: 'Simon Holt', short: 'Simon', age: 31, sex: 'm',
    role: 'Missing person (nine months)', job: 'Missing', workplace: 'riverbank', home: 'riverbank',
    color: 0x2a2d2c, accent: 0x8b806e, skin: 0xb99278, hair: 0x2c2119, build: 0.98,
    traits: {}, alibi: '', alibiWitness: '', alibiTruth: true, alibiWeak: false,
    sect: 'Unknown · vanished', public: false, suspect: false, witness: false, missing: true,
    secret: 'He found the undercroft and was kept there. He may still be alive.',
    greeting: '…',
    victimTalk: '…', sectTalk: '…', pressure: '…',
    asylum: '…',
  },
];

export const SUSPECT_IDS = ['silas', 'edith', 'jonah', 'caleb', 'isaac'];
export const WITNESS_LINES = {
  tomas: 'Jonah Pike? He was here until close. Left around two, same as always. Whatever you are looking for, it is not him.',
  dana: 'Dr. Vale was in the morgue until two. I brought her coffee at midnight. She was elbow-deep in a John Doe. She did not leave.',
  jonah: 'Father Crane? I saw the chapel lights until eleven. The door was locked when I made rounds. He was inside. I am certain.',
  ellis: 'Mr. Rourke? Meeting ended at ten. I drove him home. He was inside by half past. I waited until the lights went out.',
  ruth: 'Caleb Rourke is a great many things, Detective. A liar among them. But he was at the meeting. I typed the minutes.',
  alma: 'Isaac Bell? His light was off by nine. I can see his back window from mine. But I did not see him leave. I did not see him at all.',
};

/* ------------------------------------------------------------------ */
/*  SECT CODEX                                                         */
/* ------------------------------------------------------------------ */
export const CODEX = [
  {
    id: 'origin', title: 'The Collapse · 1889', tag: 'HISTORY',
    body: 'On the ninth of October, 1889, the Vane mine flooded. Nine men were trapped below Mercy Falls. Rescue crews reached them on the ninth day. Eight were dead, arranged in a circle around a ninth man who was still breathing: the preacher Elias Vane. Vane said the Hollow Lamb had spoken to him in the dark and offered the town a covenant. The town believed him.',
  },
  {
    id: 'covenant', title: 'The Covenant of the Ninth Hour', tag: 'DOCTRINE',
    body: 'The Lamb was slaughtered at the ninth hour so the world would not be unmade. Its wound is beneath Mercy Falls. The town lives because the wound is kept fed. Every generation, nine marked souls must be returned at the ninth hour of the ninth day. The congregation calls this the Reaping. The orthodox call it a debt. The reformers call it a story that has been allowed to become true.',
  },
  {
    id: 'marked', title: 'The Marked', tag: 'DOCTRINE',
    body: 'The marked are those born at the ninth hour, or those touched by the nine deaths. They carry a portion of the Lamb\'s wound. They are not victims in the theology — they are repayments. The Ledger records every mark and every debt. A mark is not permitted to refuse the return.',
  },
  {
    id: 'hand', title: 'The Hand', tag: 'RITUAL',
    body: 'The Hand is the one who performs the return. The Hand is not appointed by the elders; the Ledger chooses. In practice the Hand volunteers, and the congregation looks away. The Hand wears no vestment. The Hand leaves the sigil so the Lamb will know the debt was paid. The Hand is promised that his name will be struck from the Ledger.',
  },
  {
    id: 'sigil', title: 'The Inverted Sigil', tag: 'SYMBOL',
    body: 'A lamb skull inside a broken circle, with nine rays. Upright, it is a prayer for mercy. Inverted, it is a demand: the debt is called. The sigil is drawn in the victim\'s blood at every return. The faithful are taught never to draw it. It appears on the undercroft floor, beneath the altar, where the stone is older than the chapel.',
  },
  {
    id: 'factions', title: 'Three Convocations', tag: 'POLITICS',
    body: 'The Orthodox, led by the Shepherd, believe the Reaping must continue literally. The Reformists, centred on the Vane line, believe the covenant is a moral inheritance and the nine souls are a metaphor for charity and grief. The Awakened believe the Lamb is waking and that the Hand must accelerate the reaping before the town is unmade. The factions share a chapel and a cemetery and very little else.',
  },
  {
    id: 'vane', title: 'The Vane Letters', tag: 'FORBIDDEN',
    body: 'Four letters in Elias Vane\'s hand, held by the library. Vane writes of "the ninth seat" and "the one who was not returned." He admits that the eight dead miners did not die in the flood. They died after. "The Lamb required a body," he writes. "I gave it theirs." The letters were sealed by the congregation in 1939 and were never meant to be read.',
  },
  {
    id: 'undercroft', title: 'The Undercroft', tag: 'PLACE',
    body: 'Beneath the chapel, older than the chapel, is a stone room with nine niches. The congregation uses it for the vigil of the ninth hour. The air is warm when it should be cold. Candles burn without being lit. The faithful do not speak of what answers when the ninth candle goes out.',
  },
  {
    id: 'cycle', title: 'The Current Cycle', tag: 'CASE',
    body: 'Nine days ago, the first mark was returned. The Reaping has begun. If nine are returned before the Hand is stopped, the covenant is renewed for another generation. The Hand is someone the town sees every day. Someone with a long coat, a steady hand, and a reason to believe the Ledger is right.',
  },
];

/* ------------------------------------------------------------------ */
/*  ENDINGS                                                            */
/* ------------------------------------------------------------------ */
export const ENDINGS = {
  best: {
    title: 'The Ninth Hour Broken',
    eyebrow: 'CASE 09-114 · CLOSED · COVENANT SEVERED',
    text: 'You put the Hand in a cell before the ninth candle could be lit. The Ledger goes into evidence, then into the state archive, then into the cold light of a courtroom. The congregation fractures. The town does not fall into the earth. It simply goes on, smaller and quieter, and the river keeps running past the foundry. Some nights you still hear the ninth bell. But you do not answer it.',
  },
  capture: {
    title: 'The Hand Taken',
    eyebrow: 'CASE 09-114 · CLOSED BY ARREST',
    text: 'The cuffs close. The town exhales. The sect buries its ledger and its dead, and the newspapers call it a lone maniac. You know better. Somewhere beneath the chapel, nine niches wait for the next generation. You have bought Mercy Falls twenty years. It is not the same as saving it.',
  },
  wrong: {
    title: 'The Wrong Man',
    eyebrow: 'CASE 09-114 · CLOSED IN ERROR',
    text: 'The man you arrested had secrets, but not that one. The real Hand attends the trial. He sits in the third row with clean hands and prays for justice. Within a week, another body is returned, arranged with the same terrible patience. The department calls it a copycat. You know it is a correction. The Ledger has not been balanced. It has only been amended.',
  },
  escape: {
    title: 'Vanished',
    eyebrow: 'CASE 09-114 · SUSPECT AT LARGE',
    text: 'By the time the warrant is signed, the room is empty. The coat is gone, the candles are cold, and the last entry in the Ledger has been torn out. A car is found at the county line, wiped clean. Mercy Falls remembers the Hand as a rumour. You remember the shape of his handwriting. Every autumn, another town reports a body arranged in a circle.',
  },
  sect: {
    title: 'The Congregation Endures',
    eyebrow: 'CASE 09-114 · SECT EXPOSED · HAND UNKNOWN',
    text: 'You expose the Ninth Hour: its ledgers, its benefactors, its graves. The state takes the chapel. The town turns on itself in the light of the evening news. But the Hand is never named. Someone takes the ninth candle from the evidence room. Someone starts a small congregation in the next county. The Lamb, if it exists, is patient.',
  },
  conspiracy: {
    title: 'The Thin Blue Wall',
    eyebrow: 'CASE 09-114 · CLOSED · DEPARTMENT COMPROMISED',
    text: 'The Hand is arrested, but the file does not end there. Captain Mercer\'s signature appears on nine suppressed missing-person reports. The mayor resigns. The department is rebuilt from the outside. You are praised in public and avoided in the corridor. You solved the murders. You did not solve the town.',
  },
  supernatural: {
    title: 'The Lamb Beneath',
    eyebrow: 'CASE 09-114 · UNRESOLVED · ANOMALOUS',
    text: 'You descend with the Ledger and a flashlight and something descends with you. The ninth candle goes out. In the dark, the stone breathes. You see a shape that is not a man and not a lamb, and it knows your name. When you wake on the chapel floor it is morning, the Hand is gone, and every clock in Mercy Falls reads 3:09. The official report lists an environmental hallucination. You do not write down what it said.',
  },
  compromised: {
    title: 'The Unravelling',
    eyebrow: 'CASE 09-114 · OFFICER RELIEVED',
    text: 'You stop sleeping. The walls begin to keep the same hours as the dead. You see the sigil in the pattern of the rain, in the grain of the desk, in the faces of the people you interview. The department places you on medical leave. The case is reassigned. On your last night in Mercy Falls you wake at 3:09 with blood under your nails and no memory of the drive to the chapel.',
  },
  cold: {
    title: 'The Cold File',
    eyebrow: 'CASE 09-114 · OPEN · UNRESOLVED',
    text: 'The ninth day passes. The town holds its breath, then its harvest festival. The bodies stop. The papers move on. The file goes into a drawer with the others, and the drawer goes into a room with no windows. You stay on in Mercy Falls. Some mornings you drive past the chapel and see the candles through the basement grate. You never stop counting them.',
  },
  death: {
    title: 'The Ninth Return',
    eyebrow: 'CASE 09-114 · OFFICER DOWN',
    text: 'You go to the undercroft alone. That is the mistake. The Hand does not hate you; he pities you. You are a mark now, a debt written in a book older than the town. They find your badge on the altar, arranged neatly, at the ninth hour. The investigation is reassigned. The Ledger has one more name, and it is yours.',
  },
};

/* ------------------------------------------------------------------ */
/*  WRITING BANKS                                                      */
/* ------------------------------------------------------------------ */
export const NEWS_HEADLINES = [
  ['HUNT FOR KILLER CONTINUES', 'Police have released few details in the death of a Mercy Falls woman found at the Vane Foundry. Residents are urged to report suspicious activity.'],
  ['CHAPEL DENIES ANY LINK TO SLAYING', 'Leaders of the Chapel of the Ninth Hour issued a statement calling the murder "an act of violence against the whole community."'],
  ['NIGHT WATCH FORMS', 'Dozens of residents gathered at Town Hall to organise neighbourhood patrols. Councilman Rourke praised their "civic courage."'],
  ['GIRL\'S DEATH RULED HOMICIDE', 'The county examiner has ruled the Foundry death a homicide by unspecified means. The department has declined to comment.'],
  ['TOWN ASKS: WHO IS THE HAND?', 'Graffiti bearing the so-called "Ninth Hour" sigil appeared overnight on the chapel wall. Police are treating it as a nuisance.'],
  ['MAYOR URGES CALM', 'In a brief address, the mayor asked residents to "let the police do their work" and to avoid rumour. Council chambers were half empty.'],
  ['SECOND VICTIM FEARED', 'A woman\'s coat was found near the river. Police have not confirmed a connection to last week\'s homicide.'],
];

export const AMBIENT_RADIO = [
  '…and the river is expected to crest by Tuesday. Officials advise avoiding the lower lots…',
  '…nine days of rain. The old-timers say the mine still remembers…',
  '…a candlelight vigil will be held at the Chapel of the Ninth Hour at seven…',
  '…if you have information about the Foundry case, call the Mercy Falls tip line…',
  '…and now, a word from Bell & Sons Hardware. If it holds, we sell it…',
  '…the county sheriff\'s office has declined to assist the investigation at this time…',
  '…temperatures will drop below freezing tonight. Check on your neighbours…',
];

export const GENERIC_LINES = {
  grief: [
    'She was kind. That is all I can tell you. She was kind and now she is gone.',
    'I keep expecting to see her at the market. The town feels smaller now.',
    'Everybody liked her. That is why this makes no sense.',
    'I did not know her well. I wish I had. I wish somebody had.',
  ],
  fear: [
    'Nobody goes out after dark anymore. Not even to the diner.',
    'You are police. Do something. That is what my taxes are for.',
    'I lock the door twice now. It does not help, but I do it.',
    'My husband wants to leave. I keep telling him it will pass. I do not know why.',
  ],
  sect: [
    'The chapel has always been good to this town. Good to us. I would not speak ill of it.',
    'My mother went to the Ninth Hour. She said the candles were warm. Warm, not hot. I never forgot that.',
    'They keep to themselves. They are quiet neighbours. That is all I know.',
    'There are two kinds of people in Mercy Falls: the ones who go to the chapel and the ones who pretend not to.',
  ],
  weather: [
    'Rain again. The river is going to take the lower fields.',
    'You can smell the foundry in the rain. Iron and wet ash.',
    'Fog came off the water this morning. Thick as milk. Could not see the chapel spire.',
    'Cold enough to snow. Too early, but that is this town for you.',
  ],
  town: [
    'Mercy Falls used to be a mining town. Now it is a place people drive through.',
    'The foundry pays half the town and the chapel owns the other half.',
    'Nothing happens here. That used to be the best thing about it.',
    'My grandfather said the mine was never sealed proper. He said it was waiting.',
  ],
  rumour: [
    'I heard they found a symbol. Like a wheel with nine spokes. On the wall. In blood.',
    'They say the girl was born at the ninth hour. They say it means something.',
    'The police captain is hiding something. My cousin works in records. She says files are missing.',
    'The councilman and the priest had a fight at the last council meeting. About the cemetery.',
    'Someone has been buying candles. All the candles. Bell\'s has a waiting list.',
  ],
};

export const GENERIC_JOBS = [
  'Machinist', 'Nurse', 'Teacher', 'Clerk', 'Welder', 'Mechanic', 'Cook', 'Bus driver',
  'Accountant', 'Carpenter', 'Pharmacist', 'Janitor', 'Farmer', 'Shop owner', 'Bank teller',
  'Reporter', 'Electrician', 'Plumber', 'Sawmill worker', 'Dispatcher', 'Security guard',
];

export const FLAVOUR_SIGNS = [
  'OPEN LATE', 'NO CREDIT', 'ROOMS BY THE NIGHT', 'FRESH COFFEE', 'WE BUY SCRAP',
  'HARDWARE · SEED · FEED', 'MERCY FALLS HERALD', 'CITY COUNCIL', 'NO TRESPASSING',
  'MILL RIVER 1887', 'BELL & SONS', 'THE NINTH HOUR',
];
