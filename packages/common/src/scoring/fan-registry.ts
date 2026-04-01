// Fan registry: all 81 fan definitions with detectors and exclusion lists.

import type { FanDef } from "./types.js";

// Category A: Meld patterns
import { pengPengHu, siAnKe, sanAnKe, shuangAnKe, menQianQing, buQiuRen, quanQiuRen, siGang, sanGang, mingGang, anGang, shuangMingGang, shuangAnGang } from "./detectors/meld-pattern.js";
// Category B: Chow relations
import { yiBanGao, xiXiangFeng, lianLiu, laoShaoFu, yiSeSanTongShun, yiSeSiTongShun, sanSeSanTongShun, yiSeSanBuGao, yiSeSiBuGao, sanSeSanBuGao, qingLong, huaLong, yiSeShuangLongHui, sanSeShuangLongHui, pingHu } from "./detectors/chow-relations.js";
// Category C: Pung relations
import { shuangTongKe, sanTongKe, yiSeSanJieGao, yiSeSiJieGao, sanSeSanJieGao } from "./detectors/pung-relations.js";
// Category D: Terminals
import { quanDaiYaoJiu, hunYaoJiu, qingYaoJiu, duanYaoJiu, quanDa, quanZhong, quanXiao, daYuWu, xiaoYuWu, yaoJiuKe, quanDaiWu, quanShuangKe } from "./detectors/terminals.js";
// Category E: Suits
import { qingYiSe, hunYiSe, ziYiSe, wuMenQi, queYiMen, wuZi, lvYiSe, tuiBuDao } from "./detectors/suits.js";
// Category F: Honors
import { jianKe, shuangJianKe, daSanYuan, xiaoSanYuan, sanFengKe, daSiXi, xiaoSiXi, quanFengKe, menFengKe } from "./detectors/honors.js";
// Category G: Waits
import { danDiaoJiang, bianZhang, kanZhang } from "./detectors/waits.js";
// Category H: Situational
import { ziMo, huaPai, miaoShouHuiChun, haiDiLaoYue, heDiLaoYu, gangShangKaiHua, qiangGangHu, huJueZhang } from "./detectors/situational.js";
// Category I: Special
import { siGuiYi, qiDui, lianQiDui, shiSanYao, quanBuKao, zuHeLong, qiXingBuKao, jiuLianBaoDeng, wuFanHu } from "./detectors/special.js";

export const FAN_REGISTRY: FanDef[] = [
  // 88 番
  { id: "大四喜", score: 88, detector: daSiXi, excludes: ["三风刻", "碰碰和", "圈风刻", "门风刻"], situational: false },
  { id: "大三元", score: 88, detector: daSanYuan, excludes: ["双箭刻", "箭刻"], situational: false },
  { id: "绿一色", score: 88, detector: lvYiSe, excludes: ["混一色"], situational: false },
  { id: "九莲宝灯", score: 88, detector: jiuLianBaoDeng, excludes: ["清一色", "门前清", "不求人", "幺九刻"], situational: false },
  { id: "四杠", score: 88, detector: siGang, excludes: ["碰碰和", "单钓将"], situational: false },
  { id: "连七对", score: 88, detector: lianQiDui, excludes: ["清一色", "不求人", "门前清", "七对", "无字", "单钓将"], situational: false },
  { id: "十三幺", score: 88, detector: shiSanYao, excludes: ["五门齐", "不求人", "门前清", "单钓将"], situational: false },

  // 64 番
  { id: "清幺九", score: 64, detector: qingYaoJiu, excludes: ["碰碰和", "全带幺九", "无字", "幺九刻"], situational: false },
  { id: "小四喜", score: 64, detector: xiaoSiXi, excludes: ["三风刻"], situational: false },
  { id: "小三元", score: 64, detector: xiaoSanYuan, excludes: ["双箭刻", "箭刻"], situational: false },
  { id: "字一色", score: 64, detector: ziYiSe, excludes: ["碰碰和", "混幺九", "全带幺九"], situational: false },
  { id: "四暗刻", score: 64, detector: siAnKe, excludes: ["碰碰和", "门前清", "不求人", "三暗刻", "双暗刻"], situational: false },
  { id: "一色双龙会", score: 64, detector: yiSeShuangLongHui, excludes: ["一色三同顺", "七对", "清一色", "平和", "缺一门", "一般高", "老少副", "无字"], situational: false },

  // 48 番
  { id: "一色四同顺", score: 48, detector: yiSeSiTongShun, excludes: ["一色三同顺", "一色三节高", "一般高", "四归一"], situational: false },
  { id: "一色四节高", score: 48, detector: yiSeSiJieGao, excludes: ["一色三节高", "一色三同顺", "碰碰和"], situational: false },

  // 32 番
  { id: "一色四步高", score: 32, detector: yiSeSiBuGao, excludes: ["一色三步高", "连六", "老少副"], situational: false },
  { id: "三杠", score: 32, detector: sanGang, excludes: [], situational: false },
  { id: "混幺九", score: 32, detector: hunYaoJiu, excludes: ["碰碰和", "全带幺九", "幺九刻"], situational: false },

  // 24 番
  { id: "七对", score: 24, detector: qiDui, excludes: ["不求人", "门前清"], situational: false },
  { id: "七星不靠", score: 24, detector: qiXingBuKao, excludes: ["五门齐", "不求人", "门前清"], situational: false },
  { id: "全双刻", score: 24, detector: quanShuangKe, excludes: ["碰碰和", "断幺九", "无字"], situational: false },
  { id: "清一色", score: 24, detector: qingYiSe, excludes: ["无字"], situational: false },
  { id: "一色三同顺", score: 24, detector: yiSeSanTongShun, excludes: ["一般高"], situational: false },
  { id: "一色三节高", score: 24, detector: yiSeSanJieGao, excludes: [], situational: false },
  { id: "全大", score: 24, detector: quanDa, excludes: ["无字", "大于五"], situational: false },
  { id: "全中", score: 24, detector: quanZhong, excludes: ["无字", "断幺九"], situational: false },
  { id: "全小", score: 24, detector: quanXiao, excludes: ["无字", "小于五"], situational: false },

  // 16 番
  { id: "清龙", score: 16, detector: qingLong, excludes: ["连六", "老少副"], situational: false },
  { id: "三色双龙会", score: 16, detector: sanSeShuangLongHui, excludes: ["喜相逢", "老少副", "平和", "无字"], situational: false },
  { id: "一色三步高", score: 16, detector: yiSeSanBuGao, excludes: [], situational: false },
  { id: "全带五", score: 16, detector: quanDaiWu, excludes: ["无字", "断幺九"], situational: false },
  { id: "三同刻", score: 16, detector: sanTongKe, excludes: ["双同刻"], situational: false },
  { id: "三暗刻", score: 16, detector: sanAnKe, excludes: ["双暗刻"], situational: false },

  // 12 番
  { id: "全不靠", score: 12, detector: quanBuKao, excludes: ["五门齐", "不求人", "门前清"], situational: false },
  { id: "组合龙", score: 12, detector: zuHeLong, excludes: ["喜相逢"], situational: false },
  { id: "大于五", score: 12, detector: daYuWu, excludes: ["无字"], situational: false },
  { id: "小于五", score: 12, detector: xiaoYuWu, excludes: ["无字"], situational: false },
  { id: "三风刻", score: 12, detector: sanFengKe, excludes: [], situational: false },

  // 8 番
  { id: "花龙", score: 8, detector: huaLong, excludes: [], situational: false },
  { id: "推不倒", score: 8, detector: tuiBuDao, excludes: [], situational: false },
  { id: "三色三同顺", score: 8, detector: sanSeSanTongShun, excludes: ["喜相逢"], situational: false },
  { id: "三色三节高", score: 8, detector: sanSeSanJieGao, excludes: [], situational: false },
  { id: "无番和", score: 8, detector: wuFanHu, excludes: [], situational: false },
  { id: "妙手回春", score: 8, detector: miaoShouHuiChun, excludes: ["自摸"], situational: true },
  { id: "海底捞月", score: 8, detector: haiDiLaoYue, excludes: ["自摸"], situational: true },
  { id: "杠上开花", score: 8, detector: gangShangKaiHua, excludes: ["自摸"], situational: true },
  { id: "抢杠和", score: 8, detector: qiangGangHu, excludes: [], situational: true },

  // 6 番
  { id: "双暗杠", score: 6, detector: shuangAnGang, excludes: ["暗杠"], situational: false },
  { id: "双箭刻", score: 6, detector: shuangJianKe, excludes: ["箭刻"], situational: false },
  { id: "全求人", score: 6, detector: quanQiuRen, excludes: ["单钓将"], situational: false },
  { id: "碰碰和", score: 6, detector: pengPengHu, excludes: [], situational: false },
  { id: "混一色", score: 6, detector: hunYiSe, excludes: [], situational: false },
  { id: "三色三步高", score: 6, detector: sanSeSanBuGao, excludes: [], situational: false },
  { id: "五门齐", score: 6, detector: wuMenQi, excludes: [], situational: false },

  // 4 番
  { id: "全带幺九", score: 4, detector: quanDaiYaoJiu, excludes: [], situational: false },
  { id: "不求人", score: 4, detector: buQiuRen, excludes: ["自摸"], situational: false },
  { id: "双明杠", score: 4, detector: shuangMingGang, excludes: ["明杠"], situational: false },
  { id: "和绝张", score: 4, detector: huJueZhang, excludes: [], situational: true },

  // 2 番
  { id: "圈风刻", score: 2, detector: quanFengKe, excludes: [], situational: false },
  { id: "门风刻", score: 2, detector: menFengKe, excludes: [], situational: false },
  { id: "箭刻", score: 2, detector: jianKe, excludes: [], situational: false },
  { id: "门前清", score: 2, detector: menQianQing, excludes: [], situational: false },
  { id: "平和", score: 2, detector: pingHu, excludes: ["无字"], situational: false },
  { id: "四归一", score: 2, detector: siGuiYi, excludes: [], situational: false },
  { id: "双同刻", score: 2, detector: shuangTongKe, excludes: [], situational: false },
  { id: "双暗刻", score: 2, detector: shuangAnKe, excludes: [], situational: false },
  { id: "暗杠", score: 2, detector: anGang, excludes: [], situational: false },
  { id: "断幺九", score: 2, detector: duanYaoJiu, excludes: [], situational: false },

  // 1 番
  { id: "一般高", score: 1, detector: yiBanGao, excludes: [], situational: false },
  { id: "喜相逢", score: 1, detector: xiXiangFeng, excludes: [], situational: false },
  { id: "连六", score: 1, detector: lianLiu, excludes: [], situational: false },
  { id: "老少副", score: 1, detector: laoShaoFu, excludes: [], situational: false },
  { id: "幺九刻", score: 1, detector: yaoJiuKe, excludes: [], situational: false },
  { id: "明杠", score: 1, detector: mingGang, excludes: [], situational: false },
  { id: "缺一门", score: 1, detector: queYiMen, excludes: [], situational: false },
  { id: "无字", score: 1, detector: wuZi, excludes: [], situational: false },
  { id: "边张", score: 1, detector: bianZhang, excludes: [], situational: false },
  { id: "坎张", score: 1, detector: kanZhang, excludes: [], situational: false },
  { id: "单钓将", score: 1, detector: danDiaoJiang, excludes: [], situational: false },
  { id: "自摸", score: 1, detector: ziMo, excludes: [], situational: true },
  { id: "花牌", score: 1, detector: huaPai, excludes: [], situational: true },
];
