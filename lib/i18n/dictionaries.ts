export const zh = {
  appName: "WortNetz",
  tagline: "结构化德语词汇追踪与网状知识库",
  login: "登录",
  signup: "注册",
  logout: "退出登录",
  dashboard: "仪表盘",
  searchPlaceholder: "输入任意德语词，例如 ging、Häusern",
  search: "查词并记录",
  searching: "正在查询…",
  recentWords: "最近收录的词",
  totalWords: "词元数",
  totalEncounters: "遇见次数",
  wordType: "词性",
  frequency: "频率等级",
  ipa: "IPA",
  dwdsLink: "在 DWDS 查看",
  englishMeaning: "英文释义",
  wordForms: "词形变化",
  plural: "复数",
  genitive: "第二格",
  noDefinition: "暂时没有可用的英文释义。",
  wiktionaryLink: "在 Wiktionary 查看",
  encounterCount: "遇见次数",
  firstSeen: "首次收录",
  lastSeen: "最近收录",
  surfaceForms: "出现过的词形",
  noWords: "还没有收录任何词。从上方搜索框开始吧。",
  notFound: "DWDS 未找到该词，已按原始输入收录。",
  authEmail: "邮箱",
  authPassword: "密码",
  authSubmit: "提交",
  authPending: "处理中…",
  authError: "登录或注册失败，请检查输入后重试。",
  loginTitle: "登录 WortNetz",
  signupTitle: "创建账号",
  toSignup: "还没有账号？去注册",
  toLogin: "已有账号？去登录",
  invalidQuery: "请输入 1 到 80 个字符的德语词。",
  serviceUnavailable: "词典服务暂不可用，请稍后再试。",
  internalError: "发生未知错误，请稍后再试。",
} as const;

export type Translation = typeof zh;
export type Locale = "zh" | "en" | "de";

const dictionaries: Partial<Record<Locale, Translation>> = {
  zh,
};

export function getDictionary(locale: string | null | undefined): Translation {
  if (locale === "en" && dictionaries.en) {
    return dictionaries.en;
  }

  if (locale === "de" && dictionaries.de) {
    return dictionaries.de;
  }

  return zh;
}
