export const sampleData = {
  "file": {
    "id": "ancient-greece-timeline",
    "type": "timeline",
    "title": "Ancient Greece",
    "start": -2700,
    "end": -146,
    "maxZoom": 5,
    "negID": "BCE",
    "posID": "CE"
  },
  "elements": [
    {
      "id": "era-bronze-age",
      "type": "era",
      "title": "Bronze Age",
      "start": -2700,
      "end": -1100,
      "color": "#8B7355",
      "tags": [
        "era",
        "bronze-age"
      ]
    },
    {
      "id": "era-dark-age",
      "type": "era",
      "title": "Greek Dark Age",
      "start": -1100,
      "end": -800,
      "color": "#4B4B4B",
      "tags": [
        "era",
        "dark-age"
      ]
    },
    {
      "id": "era-archaic",
      "type": "era",
      "title": "Archaic Period",
      "start": -800,
      "end": -480,
      "color": "#A68A64",
      "tags": [
        "era",
        "archaic"
      ]
    },
    {
      "id": "era-classical",
      "type": "era",
      "title": "Classical Period",
      "start": -480,
      "end": -323,
      "color": "#F4D05A",
      "tags": [
        "era",
        "classical"
      ]
    },
    {
      "id": "era-hellenistic",
      "type": "era",
      "title": "Hellenistic Period",
      "start": -323,
      "end": -146,
      "color": "#8A7FAF",
      "tags": [
        "era",
        "hellenistic"
      ]
    },
    {
      "id": "span-minoan-civilization",
      "type": "span",
      "title": "Minoan Civilization",
      "start": -2700,
      "end": -1450,
      "color": "#B8860B",
      "branches": [],
      "forks": [],
      "tags": [
        "civilization",
        "crete"
      ]
    },
    {
      "id": "span-mycenaean-civilization",
      "type": "span",
      "title": "Mycenaean Civilization",
      "start": -1600,
      "end": -1100,
      "color": "#8B4513",
      "branches": [],
      "forks": [],
      "tags": [
        "civilization",
        "mycenae"
      ]
    },
    {
      "id": "span-athens",
      "type": "span",
      "title": "Athens",
      "start": -800,
      "end": -146,
      "color": "#2E4C6D",
      "branches": [
        "span-delian-league"
      ],
      "forks": [],
      "tags": [
        "city-state",
        "athens"
      ]
    },
    {
      "id": "span-sparta",
      "type": "span",
      "title": "Sparta",
      "start": -800,
      "end": -146,
      "color": "#8B0000",
      "branches": [
        "span-peloponnesian-league"
      ],
      "forks": [],
      "tags": [
        "city-state",
        "sparta"
      ]
    },
    {
      "id": "span-delian-league",
      "type": "span",
      "title": "Delian League",
      "start": -478,
      "end": -404,
      "color": "#4A7BA7",
      "branches": [],
      "forks": [],
      "tags": [
        "alliance",
        "athens"
      ]
    },
    {
      "id": "span-peloponnesian-league",
      "type": "span",
      "title": "Peloponnesian League",
      "start": -550,
      "end": -366,
      "color": "#A52A2A",
      "branches": [],
      "forks": [],
      "tags": [
        "alliance",
        "sparta"
      ]
    },
    {
      "id": "span-macedon",
      "type": "span",
      "title": "Kingdom of Macedon",
      "start": -808,
      "end": -146,
      "color": "#6A5ACD",
      "branches": [
        "span-macedon-expansion",
        "span-ptolemaic-egypt",
        "span-seleucid-empire"
      ],
      "forks": [],
      "tags": [
        "kingdom",
        "macedon"
      ]
    },
    {
      "id": "span-macedon-expansion",
      "type": "span",
      "title": "Macedonian Hegemony",
      "start": -338,
      "end": -146,
      "color": "#7B68EE",
      "branches": [],
      "forks": [],
      "tags": [
        "macedon",
        "hegemony"
      ]
    },
    {
      "id": "span-ptolemaic-egypt",
      "type": "span",
      "title": "Ptolemaic Kingdom",
      "start": -323,
      "end": -146,
      "color": "#DAA520",
      "branches": [],
      "forks": [],
      "tags": [
        "successor-state",
        "egypt"
      ]
    },
    {
      "id": "span-seleucid-empire",
      "type": "span",
      "title": "Seleucid Empire",
      "start": -323,
      "end": -146,
      "color": "#CD853F",
      "branches": [],
      "forks": [],
      "tags": [
        "successor-state",
        "persia"
      ]
    },
    {
      "id": "span-corinth",
      "type": "span",
      "title": "Corinth",
      "start": -700,
      "end": -146,
      "color": "#5F9EA0",
      "branches": [],
      "forks": [],
      "tags": [
        "city-state",
        "trade"
      ]
    },
    {
      "id": "span-thebes",
      "type": "span",
      "title": "Thebes",
      "start": -800,
      "end": -335,
      "color": "#8B4789",
      "branches": [],
      "forks": [],
      "tags": [
        "city-state",
        "thebes"
      ]
    },
    {
      "id": "span-syracuse",
      "type": "span",
      "title": "Syracuse",
      "start": -734,
      "end": -146,
      "color": "#CD5C5C",
      "branches": [],
      "forks": [],
      "tags": [
        "city-state",
        "colony",
        "sicily"
      ]
    },
    {
      "id": "span-persian-empire",
      "type": "span",
      "title": "Achaemenid Persian Empire",
      "start": -550,
      "end": -330,
      "color": "#df95a4",
      "branches": [],
      "forks": [],
      "tags": [
        "empire",
        "persia"
      ]
    },
    {
      "id": "event-knossos-palace",
      "type": "event",
      "title": "Palace of Knossos Built",
      "date": -2000,
      "parents": [
        "span-minoan-civilization"
      ],
      "importance": 4,
      "color": "#DEB887",
      "tags": [
        "architecture",
        "crete"
      ]
    },
    {
      "id": "event-thera-eruption",
      "type": "event",
      "title": "Thera Volcanic Eruption",
      "date": -1628,
      "parents": [
        "span-minoan-civilization"
      ],
      "importance": 5,
      "color": "#FF6347",
      "tags": [
        "disaster",
        "volcano"
      ]
    },
    {
      "id": "event-linear-b",
      "type": "event",
      "title": "Linear B Script Developed",
      "date": -1450,
      "parents": [
        "span-mycenaean-civilization"
      ],
      "importance": 3,
      "color": "#F5DEB3",
      "tags": [
        "writing",
        "culture"
      ]
    },
    {
      "id": "event-trojan-war",
      "type": "event",
      "title": "Trojan War",
      "date": -1194,
      "parents": [
        "span-mycenaean-civilization"
      ],
      "importance": 5,
      "color": "#CD853F",
      "tags": [
        "war",
        "legend"
      ]
    },
    {
      "id": "event-dorian-invasion",
      "type": "event",
      "title": "Dorian Invasion",
      "date": -1100,
      "parents": [],
      "importance": 5,
      "color": "#696969",
      "tags": [
        "migration",
        "invasion"
      ]
    },
    {
      "id": "event-homer-iliad",
      "type": "event",
      "title": "Homer Composes the Iliad",
      "date": -760,
      "parents": [],
      "importance": 5,
      "color": "#FFD700",
      "tags": [
        "literature",
        "epic"
      ]
    },
    {
      "id": "event-first-olympics",
      "type": "event",
      "title": "First Olympic Games",
      "date": -776,
      "parents": [],
      "importance": 5,
      "color": "#FFD700",
      "tags": [
        "athletics",
        "religion",
        "culture"
      ]
    },
    {
      "id": "event-greek-alphabet",
      "type": "event",
      "title": "Greek Alphabet Adopted",
      "date": -750,
      "parents": [],
      "importance": 4,
      "color": "#DDA0DD",
      "tags": [
        "writing",
        "culture"
      ]
    },
    {
      "id": "event-colonization-syracuse",
      "type": "event",
      "title": "Foundation of Syracuse",
      "date": -734,
      "parents": [],
      "importance": 4,
      "color": "#FA8072",
      "tags": [
        "colonization",
        "sicily"
      ]
    },
    {
      "id": "event-lycurgus-reforms",
      "type": "event",
      "title": "Lycurgus Reforms Sparta",
      "date": -650,
      "parents": [
        "span-sparta"
      ],
      "importance": 4,
      "color": "#B22222",
      "tags": [
        "politics",
        "reform",
        "sparta"
      ]
    },
    {
      "id": "event-solon-reforms",
      "type": "event",
      "title": "Solon's Reforms in Athens",
      "date": -594,
      "parents": [
        "span-athens"
      ],
      "importance": 4,
      "color": "#4682B4",
      "tags": [
        "politics",
        "reform",
        "athens"
      ]
    },
    {
      "id": "event-peisistratus-tyrant",
      "type": "event",
      "title": "Peisistratus Becomes Tyrant",
      "date": -546,
      "parents": [
        "span-athens"
      ],
      "importance": 3,
      "color": "#5F9EA0",
      "tags": [
        "politics",
        "tyranny",
        "athens"
      ]
    },
    {
      "id": "event-cleisthenes-democracy",
      "type": "event",
      "title": "Cleisthenes Establishes Democracy",
      "date": -508,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#4169E1",
      "tags": [
        "politics",
        "democracy",
        "athens"
      ]
    },
    {
      "id": "event-ionian-revolt",
      "type": "event",
      "title": "Ionian Revolt",
      "date": -499,
      "parents": [
        "span-persian-empire"
      ],
      "importance": 4,
      "color": "#DC143C",
      "tags": [
        "war",
        "revolt",
        "persia"
      ]
    },
    {
      "id": "event-battle-marathon",
      "type": "event",
      "title": "Battle of Marathon",
      "date": -490,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#4682B4",
      "tags": [
        "battle",
        "persian-wars",
        "athens"
      ]
    },
    {
      "id": "event-thermopylae",
      "type": "event",
      "title": "Battle of Thermopylae",
      "date": -480,
      "parents": [
        "span-sparta"
      ],
      "importance": 5,
      "color": "#8B0000",
      "tags": [
        "battle",
        "persian-wars",
        "sparta"
      ]
    },
    {
      "id": "event-battle-salamis",
      "type": "event",
      "title": "Battle of Salamis",
      "date": -480,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#1E90FF",
      "tags": [
        "battle",
        "naval",
        "persian-wars"
      ]
    },
    {
      "id": "event-battle-plataea",
      "type": "event",
      "title": "Battle of Plataea",
      "date": -479,
      "parents": [
        "span-sparta"
      ],
      "importance": 4,
      "color": "#B22222",
      "tags": [
        "battle",
        "persian-wars"
      ]
    },
    {
      "id": "event-delian-league-formed",
      "type": "event",
      "title": "Formation of Delian League",
      "date": -478,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#4682B4",
      "tags": [
        "alliance",
        "politics",
        "athens"
      ]
    },
    {
      "id": "event-pericles-power",
      "type": "event",
      "title": "Pericles Rises to Power",
      "date": -461,
      "parents": [
        "span-athens"
      ],
      "importance": 4,
      "color": "#4169E1",
      "tags": [
        "politics",
        "athens",
        "golden-age"
      ]
    },
    {
      "id": "event-parthenon-built",
      "type": "event",
      "title": "Parthenon Completed",
      "date": -438,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#F0E68C",
      "tags": [
        "architecture",
        "culture",
        "athens"
      ]
    },
    {
      "id": "event-peloponnesian-war-start",
      "type": "event",
      "title": "Peloponnesian War Begins",
      "date": -431,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#8B4513",
      "tags": [
        "war",
        "conflict"
      ]
    },
    {
      "id": "event-plague-athens",
      "type": "event",
      "title": "Plague of Athens",
      "date": -430,
      "parents": [
        "span-athens"
      ],
      "importance": 4,
      "color": "#556B2F",
      "tags": [
        "disaster",
        "disease",
        "athens"
      ]
    },
    {
      "id": "event-socrates-trial",
      "type": "event",
      "title": "Trial and Death of Socrates",
      "date": -399,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#9370DB",
      "tags": [
        "philosophy",
        "culture",
        "athens"
      ]
    },
    {
      "id": "event-peloponnesian-war-end",
      "type": "event",
      "title": "Athens Surrenders to Sparta",
      "date": -404,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#8B0000",
      "tags": [
        "war",
        "defeat"
      ]
    },
    {
      "id": "event-xenophon-anabasis",
      "type": "event",
      "title": "March of the Ten Thousand",
      "date": -401,
      "parents": [
        "span-sparta"
      ],
      "importance": 3,
      "color": "#BC8F8F",
      "tags": [
        "military",
        "expedition"
      ]
    },
    {
      "id": "event-plato-academy",
      "type": "event",
      "title": "Plato Founds the Academy",
      "date": -387,
      "parents": [
        "span-athens"
      ],
      "importance": 5,
      "color": "#DDA0DD",
      "tags": [
        "philosophy",
        "education",
        "athens"
      ]
    },
    {
      "id": "event-battle-leuctra",
      "type": "event",
      "title": "Battle of Leuctra",
      "date": -371,
      "parents": [
        "span-thebes"
      ],
      "importance": 4,
      "color": "#8B4789",
      "tags": [
        "battle",
        "thebes"
      ]
    },
    {
      "id": "event-philip-macedon",
      "type": "event",
      "title": "Philip II Becomes King of Macedon",
      "date": -359,
      "parents": [
        "span-macedon"
      ],
      "importance": 5,
      "color": "#6A5ACD",
      "tags": [
        "politics",
        "macedon"
      ]
    },
    {
      "id": "event-battle-chaeronea",
      "type": "event",
      "title": "Battle of Chaeronea",
      "date": -338,
      "parents": [
        "span-macedon"
      ],
      "importance": 5,
      "color": "#9370DB",
      "tags": [
        "battle",
        "macedon"
      ]
    },
    {
      "id": "event-philip-assassination",
      "type": "event",
      "title": "Assassination of Philip II",
      "date": -336,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#8B008B",
      "tags": [
        "assassination",
        "politics",
        "macedon"
      ]
    },
    {
      "id": "event-alexander-accession",
      "type": "event",
      "title": "Alexander III Becomes King",
      "date": -336,
      "parents": [
        "span-macedon"
      ],
      "importance": 5,
      "color": "#9370DB",
      "tags": [
        "politics",
        "macedon"
      ]
    },
    {
      "id": "event-alexander-egypt",
      "type": "event",
      "title": "Alexander Enters Egypt",
      "date": -332,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#DAA520",
      "tags": [
        "conquest",
        "egypt",
        "alexander"
      ]
    },
    {
      "id": "event-battle-hydaspes",
      "type": "event",
      "title": "Battle of Hydaspes",
      "date": -326,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#8B7355",
      "tags": [
        "battle",
        "india",
        "alexander"
      ]
    },
    {
      "id": "event-alexander-death",
      "type": "event",
      "title": "Death of Alexander the Great",
      "date": -323,
      "parents": [
        "span-macedon"
      ],
      "importance": 5,
      "color": "#8B008B",
      "tags": [
        "death",
        "alexander"
      ]
    },
    {
      "id": "event-aristotle-death",
      "type": "event",
      "title": "Death of Aristotle",
      "date": -322,
      "parents": [
        "span-athens"
      ],
      "importance": 4,
      "color": "#9370DB",
      "tags": [
        "philosophy",
        "death"
      ]
    },
    {
      "id": "event-battle-ipsus",
      "type": "event",
      "title": "Battle of Ipsus",
      "date": -301,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#CD5C5C",
      "tags": [
        "battle",
        "diadochi"
      ]
    },
    {
      "id": "event-museum-alexandria",
      "type": "event",
      "title": "Library of Alexandria Founded",
      "date": -283,
      "parents": [
        "span-ptolemaic-egypt"
      ],
      "importance": 5,
      "color": "#FFD700",
      "tags": [
        "education",
        "library",
        "egypt"
      ]
    },
    {
      "id": "event-colossus-rhodes",
      "type": "event",
      "title": "Colossus of Rhodes Built",
      "date": -280,
      "parents": [],
      "importance": 3,
      "color": "#DAA520",
      "tags": [
        "architecture",
        "wonder"
      ]
    },
    {
      "id": "event-achaean-league",
      "type": "event",
      "title": "Formation of Achaean League",
      "date": -280,
      "parents": [],
      "importance": 3,
      "color": "#5F9EA0",
      "tags": [
        "alliance",
        "politics"
      ]
    },
    {
      "id": "event-archimedes-syracuse",
      "type": "event",
      "title": "Archimedes Active in Syracuse",
      "date": -250,
      "parents": [
        "span-syracuse"
      ],
      "importance": 4,
      "color": "#87CEEB",
      "tags": [
        "science",
        "mathematics"
      ]
    },
    {
      "id": "event-first-barney-war-begins",
      "type": "event",
      "title": "First Barney War Begins",
      "date": -264,
      "parents": [
        "span-syracuse"
      ],
      "importance": 4,
      "color": "#B22222",
      "tags": [
        "war",
        "rome",
        "carthage"
      ]
    },
    {
      "id": "event-cleomenes-reforms",
      "type": "event",
      "title": "Cleomenes III Reforms Sparta",
      "date": -227,
      "parents": [
        "span-sparta"
      ],
      "importance": 3,
      "color": "#8B0000",
      "tags": [
        "reform",
        "sparta"
      ]
    },
    {
      "id": "event-battle-sellasia",
      "type": "event",
      "title": "Battle of Sellasia",
      "date": -222,
      "parents": [
        "span-sparta"
      ],
      "importance": 3,
      "color": "#DC143C",
      "tags": [
        "battle",
        "sparta"
      ]
    },
    {
      "id": "event-second-punic-war",
      "type": "event",
      "title": "Second Punic War Begins",
      "date": -218,
      "parents": [],
      "importance": 3,
      "color": "#8B4513",
      "tags": [
        "war",
        "rome",
        "carthage"
      ]
    },
    {
      "id": "event-first-macedonian-war",
      "type": "event",
      "title": "First Macedonian War",
      "date": -214,
      "parents": [
        "span-macedon"
      ],
      "importance": 3,
      "color": "#9370DB",
      "tags": [
        "war",
        "rome",
        "macedon"
      ]
    },
    {
      "id": "event-archimedes-death",
      "type": "event",
      "title": "Death of Archimedes",
      "date": -212,
      "parents": [
        "span-syracuse"
      ],
      "importance": 4,
      "color": "#696969",
      "tags": [
        "death",
        "science"
      ]
    },
    {
      "id": "event-second-macedonian-war",
      "type": "event",
      "title": "Second Macedonian War",
      "date": -200,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#8B4789",
      "tags": [
        "war",
        "rome",
        "macedon"
      ]
    },
    {
      "id": "event-battle-cynoscephalae",
      "type": "event",
      "title": "Battle of Cynoscephalae",
      "date": -197,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#DC143C",
      "tags": [
        "battle",
        "rome",
        "macedon"
      ]
    },
    {
      "id": "event-third-macedonian-war",
      "type": "event",
      "title": "Third Macedonian War",
      "date": -171,
      "parents": [
        "span-macedon"
      ],
      "importance": 4,
      "color": "#9932CC",
      "tags": [
        "war",
        "rome",
        "macedon"
      ]
    },
    {
      "id": "event-battle-pydna",
      "type": "event",
      "title": "Battle of Pydna",
      "date": -168,
      "parents": [
        "span-macedon"
      ],
      "importance": 5,
      "color": "#8B0000",
      "tags": [
        "battle",
        "rome",
        "macedon"
      ]
    },
    {
      "id": "event-fourth-macedonian-war",
      "type": "event",
      "title": "Fourth Macedonian War",
      "date": -150,
      "parents": [
        "span-macedon"
      ],
      "importance": 3,
      "color": "#A52A2A",
      "tags": [
        "war",
        "rome",
        "macedon"
      ]
    },
    {
      "id": "event-achaean-war",
      "type": "event",
      "title": "Achaean War",
      "date": -146,
      "parents": [
        "span-corinth"
      ],
      "importance": 4,
      "color": "#B22222",
      "tags": [
        "war",
        "rome"
      ]
    },
    {
      "id": "event-corinth-destroyed",
      "type": "event",
      "title": "Destruction of Corinth",
      "date": -146,
      "parents": [
        "span-corinth"
      ],
      "importance": 5,
      "color": "#8B0000",
      "tags": [
        "destruction",
        "rome",
        "conquest"
      ]
    },
    {
      "id": "event-pythagoras-theorem",
      "type": "event",
      "title": "Pythagoras Active",
      "date": -530,
      "parents": [],
      "importance": 4,
      "color": "#DDA0DD",
      "tags": [
        "mathematics",
        "philosophy"
      ]
    },
    {
      "id": "event-herodotus-histories",
      "type": "event",
      "title": "Herodotus Writes Histories",
      "date": -440,
      "parents": [
        "span-athens"
      ],
      "importance": 4,
      "color": "#F5DEB3",
      "tags": [
        "history",
        "literature"
      ]
    },
    {
      "id": "event-euclid-elements",
      "type": "event",
      "title": "Euclid's Elements",
      "date": -300,
      "parents": [
        "span-ptolemaic-egypt"
      ],
      "importance": 5,
      "color": "#98FB98",
      "tags": [
        "mathematics",
        "geometry"
      ]
    },
    {
      "id": "event-hippocrates-medicine",
      "type": "event",
      "title": "Hippocrates Practices Medicine",
      "date": -430,
      "parents": [],
      "importance": 4,
      "color": "#87CEEB",
      "tags": [
        "medicine",
        "science"
      ]
    }
  ]
};
