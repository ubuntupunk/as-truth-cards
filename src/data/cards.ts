
export interface CardData {
  id: number;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
  sources?: string[]; // Added sources field
}

export const cards: CardData[] = [
  {
    id: 1,
    title: "The Global Conspiracy",
    frontDescription: "Jews control the world's governments and financial systems.",
    backDescription: "This myth ignores the diversity of political and economic systems worldwide. Jewish people, like all groups, have varied political views and economic situations. This conspiracy theory has been used to scapegoat Jews for complex societal problems and has roots in the debunked 'Protocols of the Elders of Zion' forgery.",
    symbol: "🌍",
    sources: [
      "United States Holocaust Memorial Museum, 'Protocols of the Elders of Zion'",
      "Anti-Defamation League, 'A Hoax of Hate: The Protocols of the Learned Elders of Zion'"
    ]
  },
  {
    id: 2,
    title: "The Media Manipulation",
    frontDescription: "Jews control all media to manipulate public opinion.",
    backDescription: "Media ownership is diverse globally, with thousands of outlets controlled by people of various backgrounds. This claim oversimplifies complex media structures and echoes historical propaganda used to portray Jews as manipulators of information. Studies show media ownership patterns reflect broad corporate interests rather than any religious or ethnic group.",
    symbol: "📺",
    sources: [
      "Columbia Journalism Review, 'Who Owns the Media?'",
      "Pew Research Center, 'State of the News Media'"
    ]
  },
  {
    id: 3,
    title: "The Dual Loyalty",
    frontDescription: "Jews are more loyal to Israel than to their home countries.",
    backDescription: "Jewish citizens, like all people, have complex identities and loyalties. Supporting Israel's right to exist doesn't imply disloyalty to one's country. Research shows Jewish citizens participate fully in civic life of their countries. This stereotype has been used throughout history to question Jewish people's patriotism, from the Dreyfus Affair to modern political discourse.",
    symbol: "🔄",
    sources: [
      "American Jewish Committee, 'AJC Survey of American Jewish Opinion'",
      "Brandeis University, 'American Jewish Population Project'"
    ]
  },
  {
    id: 4,
    title: "The Blood Libel",
    frontDescription: "Jews engage in ritual murder of non-Jews, especially children.",
    backDescription: "This is one of the oldest antisemitic falsehoods, repeatedly disproven over centuries. Jewish religious law explicitly forbids murder and consumption of blood (kashrut laws). Historians trace this myth to medieval Europe where it was used to justify violence against Jewish communities. No evidence has ever supported these claims despite extensive historical investigation.",
    symbol: "💉",
    sources: [
      "Magda Teter, 'Blood Libel: On the Trail of an Antisemitic Myth'",
      "Yad Vashem, 'Blood Libel: A False, Incendiary Claim Against Jews'"
    ]
  },
  {
    id: 5,
    title: "The Economic Exploitation",
    frontDescription: "Jews are greedy and exploit others for financial gain.",
    backDescription: "This stereotype stems from medieval restrictions that limited Jews to certain professions, including moneylending (when the Church forbade Christians from lending with interest). Economic data shows Jewish communities reflect the same diversity of economic status as other groups. This stereotyping ignores historical context and the forced economic roles imposed on Jewish communities throughout European history.",
    symbol: "💰",
    sources: [
      "Jerry Z. Muller, 'Capitalism and the Jews'",
      "Jonathan Sarna, 'American Judaism: A History'"
    ]
  },
  {
    id: 6,
    title: "The Holocaust Denial",
    frontDescription: "The Holocaust never happened or was greatly exaggerated.",
    backDescription: "The Holocaust is one of the most thoroughly documented events in history, with vast evidence including Nazi records, survivor testimonies, liberation footage, physical sites, and German documentation. Thousands of historical studies confirm approximately six million Jews were murdered. Courts have repeatedly rejected denial claims when examining historical evidence. Holocaust denial is recognized as a form of antisemitism by the International Holocaust Remembrance Alliance.",
    symbol: "❌",
    sources: [
      "Deborah Lipstadt, 'Denying the Holocaust: The Growing Assault on Truth and Memory'",
      "United States Holocaust Memorial Museum, 'Holocaust Encyclopedia'"
    ]
  },
  {
    id: 7,
    title: "The Palestinian Struggle Myth",
    frontDescription: "The Palestinian struggle is solely about religion and hatred of Jews.",
    backDescription: "The Israeli-Palestinian conflict is complex, involving territorial disputes, historical claims, security concerns, and political rights. Academic research shows the conflict emerged from competing national movements, colonial history, and geopolitical factors. While religious elements exist, reducing it to religious hatred oversimplifies a multifaceted conflict with legitimate concerns on both sides that requires nuanced understanding.",
    symbol: "⚔️",
    sources: [
      "Rashid Khalidi, 'The Hundred Years' War on Palestine'",
      "Anita Shapira, 'Israel: A History'",
      "Benny Morris, '1948: A History of the First Arab-Israeli War'"
    ]
  },
  {
    id: 8,
    title: "The Globalist Agenda",
    frontDescription: "Jewish 'globalists' are undermining national sovereignty for personal gain.",
    backDescription: "The term 'globalist' often serves as an antisemitic dog whistle. Global cooperation on trade, climate, and security involves people of all backgrounds. Studies of international organizations show diverse leadership representing many nations and backgrounds. This conspiracy theory updates ancient suspicions of Jewish people as disloyal to nation-states, while ignoring the reality of how international cooperation functions.",
    symbol: "🌐",
    sources: [
      "Anti-Defamation League, 'Antisemitism Uncovered: A Guide to Old Myths in a New Era'",
      "U.S. State Department, 'Contemporary Global Antisemitism Report'"
    ]
  },
  {
    id: 9,
    title: "The Scapegoat",
    frontDescription: "Jews are responsible for economic crises and social problems.",
    backDescription: "Economic downturns and social issues have complex, systemic causes documented by historians and economists. During the 2008 financial crisis, for example, regulatory failures and banking practices involving people of many backgrounds were responsible. Blaming Jews for societal problems diverts attention from addressing real causes of inequality and injustice, a tactic used throughout history from medieval plagues to modern economic challenges.",
    symbol: "🐐",
    sources: [
      "Economic Policy Institute, 'The State of Working America'",
      "David Biale, 'Power and Powerlessness in Jewish History'"
    ]
  },
  {
    id: 10,
    title: "The Puppet Master",
    frontDescription: "Jews secretly control world events from behind the scenes.",
    backDescription: "World events result from complex interactions between governments, economic forces, social movements, and historical contexts as shown by extensive political science research. This myth portrays Jews as all-powerful manipulators, contradicting the historical reality of Jewish vulnerability and persecution. The persistence of this myth relies on confirmation bias rather than evidence, similar to other conspiracy theories that oversimplify complex global systems.",
    symbol: "🎭",
    sources: [
      "Jeffrey Herf, 'The Jewish Enemy: Nazi Propaganda During World War II and the Holocaust'",
      "Steven Pinker, 'Enlightenment Now: The Case for Reason, Science, Humanism, and Progress'"
    ]
  }
];
