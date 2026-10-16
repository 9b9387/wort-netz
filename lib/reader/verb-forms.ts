/**
 * Curated forms of the most common German irregular verbs.
 *
 * The reader otherwise lemmatizes with suffix rules plus whatever inflection
 * table a dictionary entry happens to carry. For strong and mixed verbs that is
 * not enough: "kam", "waren" or "gewesen" cannot be derived from "kommen" /
 * "sein" by stripping an ending, and OdeNet even contains a noun entry for
 * "waren", which used to win over the verb.
 *
 * Only irregular forms are listed here — present tense forms of regular verbs
 * ("macht", "geht") come from the suffix rules.
 *
 * Known ambiguity: "weiß" is both the verb form (ich weiß) and the colour
 * adjective. The table maps it to the verb, which is the more frequent reading
 * in running text.
 */

export type IrregularVerb = {
  infinitive: string;
  forms: readonly string[];
};

export const IRREGULAR_VERBS: readonly IrregularVerb[] = [
  {
    infinitive: "sein",
    forms: [
      "bin", "bist", "ist", "sind", "seid", "war", "warst", "waren", "wart",
      "gewesen", "wäre", "wärst", "wären", "wärt", "sei", "seien",
    ],
  },
  {
    infinitive: "haben",
    forms: [
      "habe", "hast", "hat", "habt", "hatte", "hattest", "hatten", "hattet",
      "gehabt", "hätte", "hättest", "hätten", "hättet",
    ],
  },
  {
    infinitive: "werden",
    forms: [
      "werde", "wirst", "wird", "werdet", "wurde", "wurdest", "wurden",
      "wurdet", "geworden", "würde", "würdest", "würden", "würdet",
    ],
  },
  {
    infinitive: "können",
    forms: [
      "kann", "kannst", "könnt", "konnte", "konntest", "konnten", "konntet",
      "gekonnt", "könnte", "könntest", "könnten", "könntet",
    ],
  },
  {
    infinitive: "müssen",
    forms: [
      "muss", "musst", "müsst", "musste", "musstest", "mussten", "musstet",
      "gemusst", "müsste", "müsstest", "müssten", "müsstet",
    ],
  },
  {
    infinitive: "dürfen",
    forms: [
      "darf", "darfst", "dürft", "durfte", "durftest", "durften", "durftet",
      "gedurft", "dürfte", "dürftest", "dürften", "dürftet",
    ],
  },
  {
    infinitive: "sollen",
    forms: [
      "soll", "sollst", "sollt", "sollte", "solltest", "sollten", "solltet",
      "gesollt",
    ],
  },
  {
    infinitive: "wollen",
    forms: [
      "will", "willst", "wollt", "wollte", "wolltest", "wollten", "wolltet",
      "gewollt",
    ],
  },
  {
    infinitive: "mögen",
    forms: [
      "mag", "magst", "mögt", "mochte", "mochtest", "mochten", "mochtet",
      "gemocht", "möchte", "möchtest", "möchten", "möchtet",
    ],
  },
  {
    infinitive: "wissen",
    forms: [
      "weiß", "weißt", "wisst", "wusste", "wusstest", "wussten", "wusstet",
      "gewusst", "wüsste", "wüsstest", "wüssten", "wüsstet",
    ],
  },
  {
    infinitive: "lassen",
    forms: ["lässt", "lasst", "ließ", "ließt", "ließen", "ließet", "gelassen", "ließe", "ließen"],
  },
  {
    infinitive: "gehen",
    forms: ["ging", "gingst", "gingen", "gingt", "gegangen", "ginge"],
  },
  {
    infinitive: "kommen",
    forms: ["kam", "kamst", "kamen", "kamt", "gekommen", "käme", "kämest", "kämen", "kämet"],
  },
  {
    infinitive: "sehen",
    forms: ["siehst", "sieht", "seht", "sah", "sahst", "sahen", "saht", "gesehen", "sähe", "sähen"],
  },
  {
    infinitive: "geben",
    forms: ["gibst", "gibt", "gebt", "gab", "gabst", "gaben", "gabt", "gegeben", "gäbe", "gäben"],
  },
  {
    infinitive: "nehmen",
    forms: ["nimmst", "nimmt", "nehmt", "nahm", "nahmst", "nahmen", "nahmt", "genommen", "nähme", "nähmen"],
  },
  {
    infinitive: "essen",
    forms: ["isst", "esst", "aß", "aßen", "gegessen", "äße", "äßen"],
  },
  {
    infinitive: "trinken",
    forms: ["trank", "trankst", "tranken", "trankt", "getrunken", "tränke"],
  },
  {
    infinitive: "fahren",
    // "führe" is left out on purpose: as a token it is far more often the verb
    // "führen" (to lead) than the subjunctive of "fahren".
    forms: ["fährst", "fährt", "fahrt", "fuhr", "fuhrst", "fuhren", "fuhrt", "gefahren"],
  },
  {
    infinitive: "laufen",
    forms: ["läufst", "läuft", "lauft", "lief", "liefst", "liefen", "lieft", "gelaufen", "liefe", "liefen"],
  },
  {
    infinitive: "schlafen",
    forms: ["schläfst", "schläft", "schlaft", "schlief", "schliefst", "schliefen", "schlieft", "geschlafen", "schliefe"],
  },
  {
    infinitive: "sprechen",
    forms: ["sprichst", "spricht", "sprecht", "sprach", "sprachst", "sprachen", "spracht", "gesprochen", "spräche", "sprächen"],
  },
  {
    infinitive: "lesen",
    forms: ["liest", "lest", "las", "lasen", "gelesen", "läse", "läsen"],
  },
  {
    infinitive: "schreiben",
    forms: ["schrieb", "schriebst", "schrieben", "schriebt", "geschrieben", "schriebe"],
  },
  {
    infinitive: "finden",
    forms: ["fand", "fandst", "fanden", "fandet", "gefunden", "fände", "fänden"],
  },
  {
    infinitive: "halten",
    forms: ["hältst", "hält", "haltet", "hielt", "hieltst", "hielten", "hieltet", "gehalten", "hielte", "hielten"],
  },
  {
    infinitive: "heißen",
    forms: ["heißt", "hieß", "hießen", "geheißen", "hieße", "hießen"],
  },
  {
    infinitive: "helfen",
    forms: ["hilfst", "hilft", "helft", "half", "halfst", "halfen", "halft", "geholfen", "hülfe", "hälfe", "hülfen"],
  },
  {
    infinitive: "treffen",
    forms: ["triffst", "trifft", "trefft", "traf", "trafst", "trafen", "traft", "getroffen", "träfe", "träfen"],
  },
  {
    infinitive: "treten",
    forms: ["trittst", "tritt", "tretet", "trat", "tratst", "traten", "tratet", "getreten", "träte", "träten"],
  },
  {
    infinitive: "ziehen",
    forms: ["zog", "zogst", "zogen", "zogt", "gezogen", "zöge", "zögen"],
  },
  {
    infinitive: "denken",
    forms: ["dachte", "dachtest", "dachten", "dachtet", "gedacht", "dächte", "dächten"],
  },
  {
    infinitive: "bringen",
    forms: ["brachte", "brachtest", "brachten", "brachtet", "gebracht", "brächte", "brächten"],
  },
  {
    infinitive: "tun",
    forms: ["tue", "tust", "tut", "tat", "tatest", "taten", "tatet", "getan", "täte", "täten"],
  },
  {
    infinitive: "stehen",
    forms: ["stand", "standst", "standen", "standet", "gestanden", "stünde", "ständen"],
  },
  {
    infinitive: "bleiben",
    forms: ["blieb", "bliebst", "blieben", "bliebt", "geblieben", "bliebe"],
  },
  {
    infinitive: "liegen",
    forms: ["lag", "lagst", "lagen", "lagt", "gelegen", "läge", "lägen"],
  },
  {
    infinitive: "sitzen",
    forms: ["saß", "saßen", "gesessen", "säße", "säßen"],
  },
  {
    infinitive: "bitten",
    forms: ["bat", "batst", "baten", "batet", "gebeten", "bäte", "bäten"],
  },
  {
    infinitive: "beginnen",
    forms: ["begann", "begannst", "begannen", "begonnen", "begänne", "begönne", "begännen"],
  },
  {
    infinitive: "gewinnen",
    forms: ["gewann", "gewannst", "gewannen", "gewonnen", "gewänne", "gewönne", "gewännen"],
  },
  {
    infinitive: "verlieren",
    forms: ["verlor", "verlorst", "verloren", "verliert", "verlöre", "verlören"],
  },
  {
    infinitive: "singen",
    forms: ["sang", "sangst", "sangen", "sangt", "gesungen", "sänge", "sängen"],
  },
  {
    infinitive: "klingen",
    forms: ["klang", "klangst", "klangen", "geklungen", "klänge", "klängen"],
  },
  {
    infinitive: "fliegen",
    forms: ["flog", "flogst", "flogen", "geflogen", "flöge", "flögen"],
  },
  {
    infinitive: "steigen",
    forms: ["stieg", "stiegst", "stiegen", "gestiegen", "stiege"],
  },
  {
    infinitive: "fallen",
    // "gefallen" is handled by its own verb below.
    forms: ["fällst", "fällt", "fallt", "fiel", "fielst", "fielen", "fielt", "fiele"],
  },
  {
    infinitive: "fangen",
    forms: ["fängst", "fängt", "fangt", "fing", "fingst", "fingen", "fingt", "gefangen", "finge"],
  },
  {
    infinitive: "hängen",
    forms: ["hängst", "hängt", "hing", "hingst", "hingen", "gehangen", "hinge"],
  },
  {
    infinitive: "brechen",
    forms: ["brichst", "bricht", "brecht", "brach", "brachst", "brachen", "bracht", "gebrochen", "bräche", "brächen"],
  },
  {
    infinitive: "schließen",
    forms: ["schließt", "schloss", "schlossen", "geschlossen", "schlösse", "schlössen"],
  },
  {
    infinitive: "schneiden",
    forms: ["schnitt", "schnittst", "schnitten", "geschnitten", "schnitte"],
  },
  {
    infinitive: "schieben",
    forms: ["schob", "schobst", "schoben", "geschoben", "schöbe"],
  },
  {
    infinitive: "rufen",
    forms: ["rufst", "ruft", "rief", "riefst", "riefen", "gerufen", "riefe"],
  },
  {
    infinitive: "raten",
    // "geraten" belongs to the separate verb below, not to "raten".
    forms: ["rätst", "rät", "riet", "rietst", "rieten", "riete"],
  },
  {
    infinitive: "werfen",
    forms: ["wirfst", "wirft", "warf", "warfst", "warfen", "geworfen", "würfe", "würfen"],
  },
  {
    infinitive: "sterben",
    forms: ["stirbst", "stirbt", "starb", "starbst", "starben", "gestorben", "stürbe", "stürben"],
  },
  {
    infinitive: "stoßen",
    forms: ["stößt", "stieß", "stießen", "gestoßen", "stieße"],
  },
  {
    infinitive: "waschen",
    forms: ["wäschst", "wäscht", "wusch", "wuschen", "gewaschen", "wüsche"],
  },
  {
    infinitive: "wachsen",
    forms: ["wächst", "wuchs", "wuchsen", "gewachsen", "wüchse"],
  },
  {
    infinitive: "verstehen",
    forms: ["verstand", "verstanden", "verstände", "verstünde"],
  },
  {
    infinitive: "bekommen",
    forms: ["bekam", "bekamst", "bekamen", "bekommt", "bekäme", "bekämen"],
  },
  {
    infinitive: "entscheiden",
    forms: ["entschied", "entschieden", "entschiede"],
  },
  {
    infinitive: "verlassen",
    forms: ["verlässt", "verließ", "verließen", "verlassen", "verließe"],
  },
  {
    infinitive: "erscheinen",
    forms: ["erschien", "erschienen", "erschiene"],
  },
  {
    infinitive: "erfahren",
    forms: ["erfährt", "erfuhr", "erfuhren", "erfahren", "erführe"],
  },
  {
    infinitive: "empfehlen",
    forms: ["empfiehlst", "empfiehlt", "empfahl", "empfahlen", "empfohlen", "empfähle"],
  },
  {
    // Separable verbs are stored under their base verb because that is the
    // lemma a dictionary returns for the bare form ("lädt" → laden).
    infinitive: "laden",
    forms: ["lädst", "lädt", "lud", "luden", "geladen", "lüde"],
  },
  {
    infinitive: "gefallen",
    // "gefallen" (the participle of "fallen") is left out so the dictionary
    // resolves it to this verb, which is the more common reading.
    forms: ["gefällst", "gefällt", "gefiel", "gefielen", "gefiele"],
  },
  {
    infinitive: "geraten",
    forms: ["gerät", "gerätst", "geriet", "gerieten", "geraten", "geriete"],
  },
];

const FORM_TO_INFINITIVE = new Map<string, string>();

for (const verb of IRREGULAR_VERBS) {
  for (const form of verb.forms) {
    const normalized = form.normalize("NFC").trim().toLowerCase();

    // First entry wins so the table stays authoritative about the base verb.
    if (normalized && !FORM_TO_INFINITIVE.has(normalized)) {
      FORM_TO_INFINITIVE.set(normalized, verb.infinitive);
    }
  }
}

/** Infinitive of a curated irregular verb form, or null. */
export function irregularVerbLemma(normalizedSurface: string): string | null {
  return FORM_TO_INFINITIVE.get(normalizedSurface) ?? null;
}

export function irregularVerbFormCount(): number {
  return FORM_TO_INFINITIVE.size;
}
