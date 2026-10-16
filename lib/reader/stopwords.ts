/**
 * German function words. They only drive dimming and the "hide function words"
 * filter — a collected function word still counts as learned, and categories
 * never use a fourth color for them.
 */
const FUNCTION_WORDS = new Set(
  `
aber alle allem allen aller alles als also am an ander andere anderem anderen anderer anderes
anfang ans auch auf aus bei beim bereits bis bist bzw ca da damit dann daran darauf daraus darin
darum darunter das dass dasselbe davon dazu dein deine deinem deinen deiner deines dem den denen
denn denselben der derer derselbe des deshalb dessen deswegen dich die dies diese dieselbe diesem
diesen dieser dieses dir doch dort drei du durch ebenfalls ehe ein eine einem einen einer eines
einige einigem einigen einiger einiges einmal er erst es etwas euer eure eurem euren eurer eures
fast für gegen gegebenenfalls gegenüber gewesen gibt hab habe haben habt hatte hatten hier hin
hinter ich ihr ihre ihrem ihren ihrer ihres im immer in indem infolge ins ist ja jede jedem jeden
jeder jedes jedoch jene jenem jenen jener jenes jetzt kann kannst kein keine keinem keinen keiner
keines können könnte konnten lange lassen lediglich leider machen man manche manchem manchen
manches mein meine meinem meinen meiner meines mich mir mit muss müssen musste mussten nach
nachdem neben nein nicht nichts nie niemand noch nun nur ob obwohl oder ohne sehr sein seine
seinem seinen seiner seines seit selbst sich sie sind so sobald schon sondern sonst sowie sowohl
statt zu zum zur zwar zwischen über um und uns unser unsere unserem unseren unseres unter viel
viele vom von vor wann warum was weder weil welche welchem welchen welcher welches wenn wer
werde werden wie wieder will wir wird wirst wo wobei wodurch wofür wogegen woher wohin wohl
wollen wollte wollten woran worauf woraus worin worüber wozu würde würden zu zugleich zum zur
zwar zwischen
`
    .split(/\s+/)
    .filter(Boolean),
);

export function isGermanFunctionWord(normalizedSurface: string): boolean {
  return FUNCTION_WORDS.has(normalizedSurface);
}

/**
 * Closed word classes (articles, pronouns, prepositions, conjunctions,
 * numerals). Unlike `isGermanFunctionWord`, this deliberately excludes verb
 * forms: a phrase such as "es gibt" is built from a pronoun *and* a verb, so it
 * is a real expression and must stay in the phrase vocabulary.
 */
const CLOSED_CLASS_WORDS = new Set(
  `
aber als am an auf aus bei beim bis da damit dann das dass dem den denen denn der derer des dessen die dies diese diesem diesen dieser dieses doch dort
du durch ein eine einem einen einer eines er es euch euer für gegen hinter ich ihm ihn ihnen ihr ihre ihrem ihren ihrer ihres im in ja jede jedem jeden jeder jedes
jene jenem jenen jener jenes jener mich mir mit nach neben nein nicht noch nur ob oder ohne seit sie sich und uns unter viel vom von vor während weil
welche welchem welchen welcher welches wenn wer wie wir wo zehn zu zum zur zwischen über
`
    .split(/\s+/)
    .filter(Boolean),
);

export function isClosedClassWord(normalizedSurface: string): boolean {
  return CLOSED_CLASS_WORDS.has(normalizedSurface);
}

/**
 * Inflected possessive determiners (meine, seinen, ihrer, unserem, …).
 *
 * They must not be lemmatized with suffix rules: stripping the case ending from
 * "seine" yields "sein", which is the verb *to be* in the dictionary, so a
 * possessive would silently be filed under the verb. The bare stems (mein,
 * dein, sein, unser, euer, ihr) stay out of this set because "sein" on its own
 * really is the verb.
 */
const POSSESSIVE_FORMS = new Set(
  `
meine meinen meinem meiner meines
deine deinen deinem deiner deines
seine seinen seinem seiner seines
ihre ihren ihrem ihrer ihres
unsere unseren unserem unserer unseres
eure euren eurem eurer eures
`
    .split(/\s+/)
    .filter(Boolean),
);

export function isPossessiveForm(normalizedSurface: string): boolean {
  return POSSESSIVE_FORMS.has(normalizedSurface);
}
