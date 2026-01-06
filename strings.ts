export type Locale = 'en' | 'he';

const en = {
  notTranslated: '[not translated]',
  enterConfig: 'Please paste your desired config in the field below. Note that it is quite bare-bone, so external editor like Notepad++ is suggested for the best experience when editing the config. The link will be available for copying at the botom.',
  enterConfigCopy: 'Here you can copy the link that can be used to run the test:',
  thisIsGo: 'Here is the GO signal. Click or press Space when you see this.',
  thisIsNogo: "Here is the NO-GO signal. Do NOT do anything when you see this.",
  doneHereAreResults: 'Done! Here are the results:',
  doneThanks: 'Thank you for participating in the study!',
  doneOverToExaminer: 'Examiner can now press Space to view the results.',
  rawResults: 'Raw results:',
  resultsNumbers: 'Results (numbers and percentages):',
  resultsTimes: 'Results (times for each step):',
  btnShow: 'Show',
  btnHide: 'Hide',
  btnCopy: 'Copy',
  btnSave: 'Save',
};

const he = {
  notTranslated: "[התרגום אינו זמין]",
  enterConfigCopy: "כאן ניתן להעתיק קישור שישמש למעבר מבחן:",
  thisIsGo: ".על המסך, עליכם להקיש על מקש הרווח במקלדת X כאשר תראו את הסימן",
  thisIsNogo: ".על המסך, עליכם לא לעשות כלום Y כאשר תראו את הסימן",
  doneHereAreResults: ":זהו! זה התוצאות",
  doneThanks: "!זה הו סיום! תודה על השתתפותך במחקר",
  doneOverToExaminer: ".הבוחן יכול להקיש על רווח כדי לצפות בתוצאות",
  rawResults: ":תוצאות גולמיות",
  resultsNumbers: ":תוצאות (מספר ואחוז)",
  resultsTimes: ":תוצאות (זמן לכל צעד)",
  btnShow: 'לְהַצִיג',
  btnHide: 'לְהַסתִיר',
  btnCopy: 'לְהַעְתִיק',
  btnSave: 'שמור קובץ',
};

type StringsGeneric = { [key: string]: string | undefined };

function merge(strings: StringsGeneric) {
  const result = structuredClone(en);
  const notTranslated = ' ' + (strings.notTranslated ?? en.notTranslated);
  for (const key of Object.keys(result)) {
    (result as StringsGeneric)[key] += notTranslated;
  }
  for (const key of Object.keys(strings)) {
    (result as StringsGeneric)[key] = strings[key];
  }
  return result;
}

let S_cached: typeof en | undefined;

export const S: () => typeof en = () => {
  if (S_cached === undefined) {
    alert('Locale undefined! Assuming en');
    S_cached = en;
  }
  return S_cached;
};

export function setLocale(locale: Locale) {
  if (locale === 'en') {
    S_cached = en;
    return;
  }
  if (locale === 'he') {
    S_cached = merge(he);
    return;
  }
  throw new Error(`invalid locale: ${locale}`);
};
