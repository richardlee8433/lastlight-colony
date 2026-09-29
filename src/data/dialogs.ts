// 劇情對話腳本（第 1～2 章）。每句：[角色, 中文, English]；log 是朱諾寫進殖民地日誌的那一段（{day} 換成天數）。
// 什麼時候播放由 engine/dialog.ts 決定；這裡只放文字。
import type { CharacterId } from '../art/portraitArt';

export type Line = [CharacterId, string, string];
export interface SceneText { lines: Line[]; log?: [string, string] }

export const SCENES: Record<string, SceneText> = {
  'c1-open': {
    lines: [
      ['mara', '點名。還在喘氣的舉手。', "Roll call. Raise your hand if you're still breathing."],
      ['teo', '我兩隻手都舉了，多算我一口氣。', 'Both hands up. Count me for two breaths.'],
      ['juno', '我舉三隻！……好啦，有一隻是提歐的扳手。', "Three hands! ...Okay, one of them is Teo's wrench."],
      ['mara', '很好，全員到齊。去殘骸堆撿廢料，從現在起，我們得自己造空氣。', "Good, everyone's here. Go strip the wreckage for scrap. From now on, we make our own air."],
    ],
    log: ['我們墜毀了。瑪拉說要有人把事情記下來，我自願了。這是殖民地日誌的第一頁。', "We crashed. Mara said someone should write things down, so I volunteered. This is the first page of the colony log."],
  },
  'c1-ls3': {
    lines: [
      ['juno', '維生系統剩三分鐘……我先來寫遺書好了。「我把我的襪子留給——」', 'Three minutes of life support left... I should write my will. "I leave my socks to—"'],
      ['teo', '誰要妳的襪子。', 'Nobody wants your socks.'],
      ['mara', '遺書晚點寫。先把氧氣再生器蓋起來，不然妳連寫完的時間都沒有。', "Will later. Build the oxygen scrubber first, or you won't have time to finish it."],
    ],
  },
  'c1-scrubber': {
    lines: [
      ['teo', '來，跟大家打招呼。牠叫阿喘。', 'Say hello, everyone. This is Wheezy.'],
      ['juno', '牠……在咳嗽耶。', "It's... coughing."],
      ['teo', '那是牠的工作聲。別嫌牠吵，牠是這顆星球上唯一願意幫我們呼吸的傢伙。', "That's its working noise. Don't knock it. Wheezy's the only thing on this planet willing to breathe for us."],
      ['mara', '阿喘，我們的命交給你了。拜託別卡痰。', 'Wheezy, our lives are in your hands. Please don\'t choke.'],
    ],
    log: ['提歐用逃生艙的殘骸拼出一台氧氣再生器，取名阿喘。牠很吵，但我們愛牠。', "Teo built an oxygen scrubber out of pod wreckage and named it Wheezy. It's loud. We love it."],
  },
  'c1-will': {
    lines: [
      ['juno', '好消息：遺書用不到了。我把它改成購物清單。', "Good news: I won't need the will. I turned it into a shopping list."],
      ['juno', '第一項：更多氧氣。第二項：襪子。', 'Item one: more oxygen. Item two: socks.'],
    ],
  },
  'c1-algae': {
    lines: [
      ['juno', '第一桶藻類收成了！我先試吃……嗯。像濕掉的紙板。', 'First batch of algae! Let me try it... hm. Like wet cardboard.'],
      ['teo', '那叫鮮味。', "That's called umami."],
      ['mara', '而且它還會吐氧氣。在這裡，能吃又能呼吸的東西，就是米其林三星。', 'And it breathes out oxygen. Out here, food you can eat and breathe is a three-star restaurant.'],
    ],
    log: ['第一桶藻類。像濕掉的紙板，提歐堅持那叫鮮味。', 'First batch of algae. Tastes like wet cardboard. Teo insists that is umami.'],
  },
  'c1-assign': {
    lines: [
      ['mara', '恭喜各位，你們現在是員工了。', "Congratulations, everyone. You're employees now."],
      ['juno', '薪水呢？', "What's the pay?"],
      ['mara', '不會死。福利是明天也不會死。', 'Not dying. Benefits include not dying tomorrow, too.'],
      ['teo', '比赫利昂給的好多了。', 'Better than Helion ever gave us.'],
    ],
  },
  'hypoxia': {
    lines: [
      ['mara', '所有人注意，氧氣見底了！慢慢呼吸，別講話——', "Everyone listen, we're out of oxygen! Breathe slowly, don't talk—"],
      ['juno', '那我可以用寫的嗎？', 'Can I write instead?'],
      ['mara', '……可以。寫「快去產氧建築多派點人」。', '...Yes. Write "put more people on the oxygen makers, now."'],
    ],
  },
  'c1-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 晚。', 'Colony log, night {day}.'],
      ['juno', '我們在加壓帳篷裡摘下頭盔。空氣有鐵鏽和藻類的味道——', 'We took our helmets off inside the pressurized tent. The air smells like rust and algae—'],
      ['juno', '但每一口，都是我們自己造的。', 'but every breath of it is one we made ourselves.'],
      ['mara', '……寫得不錯。', "...That's not bad."],
      ['juno', '瑪拉，妳在哭嗎？', 'Mara, are you crying?'],
      ['mara', '是藻類。過敏。', "It's the algae. Allergies."],
    ],
    log: ['今晚，我們在加壓帳篷裡摘下頭盔。空氣有鐵鏽和藻類的味道，但每一口都是我們自己造的。', 'Tonight we took our helmets off inside the pressurized tent. The air smells like rust and algae, but every breath of it is one we made ourselves.'],
  },
  'c2-open': {
    lines: [
      ['juno', '瑪拉！地平線那邊有東西在反光！', 'Mara! Something is glinting on the horizon!'],
      ['mara', '另一艘逃生艙。代表還有更多人……', 'Another escape pod. That means more people...'],
      ['teo', '更多張嘴。', 'More mouths.'],
      ['mara', '還有更多肺。阿喘一台喘不過來了，我們得讓空氣夠大家分。', 'And more lungs. Wheezy can\'t keep up alone. We need enough air to go around.'],
    ],
  },
  'c2-elec': {
    lines: [
      ['teo', '電解站鑽到冰層了！冰變水、水變氧氣，剩下的氫……先別點火。', 'The electrolyzer hit the ice! Ice to water, water to oxygen, and the leftover hydrogen... nobody light a match.'],
      ['juno', '我可以取名字嗎？叫「大口吸」！', 'Can I name it? "Big Gulp"!'],
      ['teo', '不行，名字是我取的。牠叫……大口吸。', 'No. I name the machines. It\'s called... Big Gulp.'],
      ['mara', '你剛剛只是重複她的話。', 'You just repeated what she said.'],
    ],
    log: ['電解站開工了，冰層底下有好多好多氧氣。提歐幫它取名「大口吸」（是我取的）。', 'The electrolyzer is running. There is so much oxygen frozen under us. Teo named it Big Gulp (I named it).'],
  },
  'c2-elec-i': {
    lines: [
      ['ines', '電解站運轉正常。冰變水、水變氧氣——這才叫工程。', 'Electrolyzer is online. Ice to water, water to oxygen. Now that is engineering.'],
      ['teo', '阿喘也是工程。', 'Wheezy is engineering too.'],
      ['ines', '阿喘是奇蹟。奇蹟不能量產。', 'Wheezy is a miracle. Miracles don\'t scale.'],
      ['juno', '我要把這句寫進日誌！', "I'm putting that in the log!"],
    ],
    log: ['伊涅絲的電解站開工了。她說阿喘是奇蹟，奇蹟不能量產。提歐假裝沒聽到，但我看到他偷偷拍了拍阿喘。', "Ines's electrolyzer is running. She said Wheezy is a miracle, and miracles don't scale. Teo pretended not to hear, but I saw him pat Wheezy."],
  },
  'c2-pop10': {
    lines: [
      ['juno', '我們十個人了！我要幫每個人取綽號。提歐是「扳手爺爺」。', "There are ten of us! I'm giving everyone nicknames. Teo is Grandpa Wrench."],
      ['teo', '……還可以。', '...Acceptable.'],
      ['juno', '瑪拉是「冷面機長」。', 'Mara is Captain Frosty.'],
      ['mara', '駁回。', 'Denied.'],
      ['juno', '「冷面機長」駁回了她的綽號。已記錄。', 'Captain Frosty has denied her nickname. Noted.'],
    ],
    log: ['我們有十個人了。我幫大家取了綽號，只有冷面機長不接受。', 'There are ten of us now. I gave everyone nicknames. Only Captain Frosty refused hers.'],
  },
  'c2-assembly': {
    lines: [
      ['ines', '提歐，你那支扳手是古董吧？桃樂絲裡隨便一支都比它好。', 'Teo, that wrench is an antique. Any tool in Dorothy beats it.'],
      ['teo', '這支扳手陪我修了三十年礦車。', 'This wrench fixed mine carts with me for thirty years.'],
      ['ines', '所以它才會那麼彎。', "That's why it's bent."],
      ['juno', '日誌：組裝工坊開張第一晚，兩位工程師為了扳手吵到天亮。', 'Log: on the assembly workshop\'s first night, two engineers argued about wrenches until dawn.'],
    ],
    log: ['組裝工坊開張第一晚，伊涅絲和提歐為了誰的扳手比較好吵到天亮。沒有人受傷。扳手除外。', "The assembly workshop's first night: Ines and Teo argued about whose wrench is better until dawn. No one was hurt. Except a wrench."],
  },
  'c2-coaster': {
    lines: [
      ['ines', '我在殘骸堆撿到這個。一塊晶板，上面的紋路會發光，不是我看過的任何文字。', 'I found this in the wreckage. A crystal plate. The patterns glow, and they are not any writing I know.'],
      ['teo', '借我看看……嗯，大小剛好。', 'Let me see... hm. Just the right size.'],
      ['ines', '剛好什麼？', 'Right size for what?'],
      ['teo', '剛好當杯墊。', 'A coaster.'],
      ['mara', '……先別丟掉。總覺得它在看我們。', "...Don't throw it out. I feel like it's watching us."],
    ],
    log: ['伊涅絲撿到一塊會發光的晶板，現在是提歐的杯墊。瑪拉說它在看我們。我把杯子拿開時，它好像比較亮。', "Ines found a glowing crystal plate. It is now Teo's coaster. Mara says it's watching us. When I lift the mug, it seems brighter."],
  },
  'c2-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 天。', 'Colony log, day {day}.'],
      ['juno', '人數翻了好幾倍，但沒有人再需要數自己還剩幾口氣。', 'There are many times more of us now, and nobody has to count their breaths anymore.'],
      ['teo', '阿喘退休了嗎？', 'Did Wheezy retire?'],
      ['juno', '沒有，牠升官了。現在是資深阿喘。', 'Nope. Promoted. Senior Wheezy now.'],
    ],
    log: ['人數翻了好幾倍，但沒有人再需要數自己還剩幾口氣。', 'There are many times more of us now, and nobody has to count their breaths anymore.'],
  },
};
