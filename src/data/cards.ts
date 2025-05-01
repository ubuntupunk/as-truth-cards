export interface SourceData {
  text: string
  url?: string
}

import { UserInteraction } from '../types/database'

export interface CardData {
  id: number
  title: string
  frontDescription: string
  backDescription: string
  symbol: string
  imageUrl?: string
  sources: SourceData[]
  tags?: string[]
  includedInPalestineStack: boolean
  isFeatured?: boolean
  interactions: UserInteraction[]
}

export const cards: CardData[] = [
  {
    id: 1,
    title: 'The Global Conspiracy',
    interactions: [],
    frontDescription: "Jews control the world's governments and financial systems.",
    backDescription:
      "This myth ignores the diversity of political and economic systems worldwide. Jewish people, like all groups, have varied political views and economic situations. This conspiracy theory has been used to scapegoat Jews for complex societal problems and has roots in the debunked 'Protocols of the Elders of Zion' forgery.",
    symbol: '🌍',
    includedInPalestineStack: false,
    isFeatured: true,
    sources: [
      {
        text: "United States Holocaust Memorial Museum, 'Protocols of the Elders of Zion'",
        url: 'https://encyclopedia.ushmm.org/content/en/article/protocols-of-the-elders-of-zion',
      },
      {
        text: "Anti-Defamation League, 'A Hoax of Hate: The Protocols of the Learned Elders of Zion'",
        url: 'https://www.adl.org/resources/backgrounder/protocols-elders-zion',
      },
    ],
  },
  {
    id: 2,
    title: 'The Media Manipulation',
    interactions: [],
    frontDescription: 'Jews control all media to manipulate public opinion.',
    backDescription:
      'Media ownership is diverse globally, with thousands of outlets controlled by people of various backgrounds. This claim oversimplifies complex media structures and echoes historical propaganda used to portray Jews as manipulators of information. Studies show media ownership patterns reflect broad corporate interests rather than any religious or ethnic group.',
    symbol: '📺',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Columbia Journalism Review, 'Who Owns the Media?'",
        url: 'https://www.cjr.org/resources',
      },
      {
        text: "Pew Research Center, 'State of the News Media'",
        url: 'https://www.pewresearch.org/topics/state-of-the-news-media/',
      },
    ],
  },
  {
    id: 3,
    title: 'The Dual Loyalty',
    interactions: [],
    frontDescription: 'Jews are more loyal to Israel than to their home countries.',
    backDescription:
      "Jewish citizens, like all people, have complex identities and loyalties. Supporting Israel's right to exist doesn't imply disloyalty to one's country. Research shows Jewish citizens participate fully in civic life of their countries. This stereotype has been used throughout history to question Jewish people's patriotism, from the Dreyfus Affair to modern political discourse.",
    symbol: '🔄',
    includedInPalestineStack: false,
    sources: [
      {
        text: "American Jewish Committee, 'AJC Survey of American Jewish Opinion'",
        url: 'https://www.ajc.org/survey-of-american-jewish-opinion',
      },
      {
        text: "Brandeis University, 'American Jewish Population Project'",
        url: 'https://www.brandeis.edu/ajpp',
      },
    ],
  },
  {
    id: 4,
    title: 'The Blood Libel',
    interactions: [],
    frontDescription: 'Jews engage in ritual murder of non-Jews, especially children.',
    backDescription:
      'This is one of the oldest antisemitic falsehoods, repeatedly disproven over centuries. Jewish religious law explicitly forbids murder and consumption of blood (kashrut laws). Historians trace this myth to medieval Europe where it was used to justify violence against Jewish communities. No evidence has ever supported these claims despite extensive historical investigation.',
    symbol: '💉',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Magda Teter, 'Blood Libel: On the Trail of an Antisemitic Myth'",
        url: 'https://www.magdateter.com/blood-libel',
      },
      {
        text: "Yad Vashem, 'Blood Libel: A False, Incendiary Claim Against Jews'",
        url: 'https://www.yadvashem.org/en/our-work/our-projects/blood-libel',
      },
    ],
  },
  {
    id: 5,
    title: 'The Economic Exploitation',
    interactions: [],
    frontDescription: 'Jews are greedy and exploit others for financial gain.',
    backDescription:
      'This stereotype stems from medieval restrictions that limited Jews to certain professions, including moneylending (when the Church forbade Christians from lending with interest). Economic data shows Jewish communities reflect the same diversity of economic status as other groups. This stereotyping ignores historical context and the forced economic roles imposed on Jewish communities throughout European history.',
    symbol: '💰',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Jerry Z. Muller, 'Capitalism and the Jews'",
        url: 'https://www.jerryzmuller.com/capitalism-and-the-jews',
      },
      {
        text: "Jonathan Sarna, 'American Judaism: A History'",
        url: 'https://www.jonathansarna.com/american-judaism-a-history',
      },
    ],
  },
  {
    id: 6,
    title: 'Holocaust Denial',
    interactions: [],
    frontDescription: 'The Holocaust never happened or was greatly exaggerated.',
    backDescription:
      'The Holocaust is one of the most thoroughly documented events in history, with vast evidence including Nazi records, survivor testimonies, liberation footage, physical sites, and German documentation. Thousands of historical studies confirm approximately six million Jews were murdered. Courts have repeatedly rejected denial claims when examining historical evidence. Holocaust denial is recognized as a form of antisemitism by the International Holocaust Remembrance Alliance.',
    symbol: '❌',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Deborah Lipstadt, 'Denying the Holocaust: The Growing Assault on Truth and Memory'",
        url: 'https://www.deborahlipstadt.com/denying-the-holocaust',
      },
      {
        text: "United States Holocaust Memorial Museum, 'Holocaust Encyclopedia'",
        url: 'https://www.ushmm.org/holocaust',
      },
    ],
  },
  {
    id: 7,
    title: 'The Palestinian Struggle Myth',
    interactions: [],
    frontDescription:
      'The Palestinian struggle is solely a nationalistic struggle and has nothing to do with religion and hatred of Jews.',
    backDescription:
      "The Israeli-Palestinian conflict is complex, involving religious disagreement, territorial disputes, historical claims, security concerns, and political rights. While academic research shows the conflict emerged from competing national movements, colonial and Imperial history, and geopolitical factors, reducing it to mere 'nationalism', downplays a history of religious conflict and oversimplifies a multifaceted conflict with legitimate concerns on both side.",
    symbol: '⚔️',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Rashid Khalidi, 'The Hundred Years' War on Palestine'",
        url: 'https://www.rashidkhalidi.com/hundred-years-war-on-palestine',
      },
      {
        text: "Anita Shapira, 'Israel: A History'",
        url: 'https://www.anitashapira.com/israel-a-history',
      },
      {
        text: "Benny Morris, '1948: A History of the First Arab-Israeli War'",
        url: 'https://www.bennymorris.com/1948-a-history-of-the-first-arab-israeli-war',
      },
    ],
  },
  {
    id: 8,
    title: 'The Globalist Agenda',
    interactions: [],
    frontDescription: "Jewish 'globalists' are undermining national sovereignty for personal gain.",
    backDescription:
      "The term 'globalist' often serves as an antisemitic dog whistle. Global cooperation on trade, climate, and security involves people of all backgrounds. Studies of international organizations show diverse leadership representing many nations and backgrounds. This conspiracy theory updates ancient suspicions of Jewish people as disloyal to nation-states, while ignoring the reality of how international cooperation functions.",
    symbol: '🌐',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Anti-Defamation League, 'Antisemitism Uncovered: A Guide to Old Myths in a New Era'",
        url: 'https://www.adl.org/resources/antisemitism-uncovered',
      },
      {
        text: "U.S. State Department, 'Contemporary Global Antisemitism Report'",
        url: 'https://www.state.gov/antisemitism/',
      },
    ],
  },
  {
    id: 9,
    title: 'The Scapegoat',
    interactions: [],
    frontDescription: 'Jews are responsible for economic crises and social problems.',
    backDescription:
      'Economic downturns and social issues have complex, systemic causes documented by historians and economists. During the 2008 financial crisis, for example, regulatory failures and banking practices involving people of many backgrounds were responsible. Blaming Jews for societal problems diverts attention from addressing real causes of inequality and injustice, a tactic used throughout history from medieval plagues to modern economic challenges.',
    symbol: '🐐',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Economic Policy Institute, 'The State of Working America'",
        url: 'https://www.epi.org/publications/state-of-working-america/',
      },
      {
        text: "David Biale, 'Power and Powerlessness in Jewish History'",
        url: 'https://www.davidbiale.com/power-and-powerlessness-in-jewish-history',
      },
    ],
  },
  {
    id: 10,
    title: 'The Puppet Master',
    interactions: [],
    frontDescription: 'Jews secretly control world events from behind the scenes.',
    backDescription:
      'World events result from complex interactions between governments, economic forces, social movements, and historical contexts as shown by extensive political science research. This myth portrays Jews as all-powerful manipulators, contradicting the historical reality of Jewish vulnerability and persecution. The persistence of this myth relies on confirmation bias rather than evidence, similar to other conspiracy theories that oversimplify complex global systems.',
    symbol: '🎭',
    includedInPalestineStack: false,
    sources: [
      {
        text: "Jeffrey Herf, 'The Jewish Enemy: Nazi Propaganda During World War II and the Holocaust'",
        url: 'https://www.jeffreyherf.com/jewish-enemy',
      },
      {
        text: "Steven Pinker, 'Enlightenment Now: The Case for Reason, Science, Humanism, and Progress'",
        url: 'https://www.stevenpinker.com/enlightenment-now',
      },
    ],
  },
]
