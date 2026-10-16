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
  meaning: "释义",
  germanLabel: "德语",
  englishLabel: "英语",
  englishMeaning: "英文释义",
  semanticRelations: "词义关系",
  synonyms: "近义词",
  antonyms: "反义词",
  hypernyms: "上位词",
  hyponyms: "下位词",
  examples: "例句",
  learningRecord: "学习记录",
  dataSources: "数据来源",
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
  notFound: "未找到这个词，请检查拼写后重试。",
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
  pronounce: "朗读",
  favorite: "收藏",
  favorited: "已收藏",
  myNotes: "我的笔记",
  notePlaceholder: "写下你的中文释义、例句、固定搭配或易错点…",
  saveNote: "保存笔记",
  savingNote: "保存中…",
  noteSaved: "已保存",
  reviewStatus: "复习状态",
  statusNew: "新词",
  statusLearning: "学习中",
  statusReviewing: "复习中",
  statusMastered: "已掌握",
  leitnerBox: "Leitner 箱",
  nextReview: "下次复习",
  notScheduled: "暂未安排",
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
