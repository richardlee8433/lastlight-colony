// 劇情對話腳本（第 1～6 章）。每句：[角色, 中文, English]；log 是朱諾寫進殖民地日誌的那一段（{day} 換成天數）。
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
  'c2-ines': {
    lines: [
      ['ines', '謝了。先說好，桃樂絲不外借。', 'Thanks. Ground rules: Dorothy is not for loan.'],
      ['juno', '桃樂絲是誰？', "Who's Dorothy?"],
      ['ines', '我的工具箱。她比大部分人可靠。', "My toolbox. She's more reliable than most people."],
      ['teo', '妳剛剛盯著阿喘看很久。有意見？', 'You were staring at Wheezy for a long time. Got a problem?'],
      ['ines', '有。牠很可愛，但撐不起十個人。地底下有冰層——給我岩材和零件，我幫牠裝上鑽頭，改建成電解站，把冰變成空氣。', "Yes. It's adorable, but it won't keep ten people breathing. There's ice under us. Give me stone and parts and I'll fit it with a drill and rebuild it into an electrolyzer that turns ice into air."],
      ['mara', '歡迎加入，伊涅絲。薪水是不會死。', 'Welcome aboard, Ines. The pay is not dying.'],
      ['ines', '……我聽說了。福利也是。', '...So I heard. Benefits too.'],
    ],
    log: ['我們救回了伊涅絲，還有她的工具箱桃樂絲。她的第一句話是：「桃樂絲不外借。」第二句是批評阿喘。提歐到現在還在生氣。', 'We rescued Ines, and her toolbox Dorothy. Her first words were "Dorothy is not for loan." Her second words criticized Wheezy. Teo is still sulking.'],
  },
  'c2-elec': {
    lines: [
      ['teo', '好了，阿喘，忍一下……', 'Alright, Wheezy, hold still...'],
      ['juno', '提歐，你在跟牠道歉嗎？', 'Teo, are you apologizing to it?'],
      ['teo', '我幫牠裝了鑽頭，一路挖到冰層。冰變水、水變氧氣——牠現在是電解站了。', "I fitted it with a drill and dug all the way down to the ice. Ice to water, water to oxygen. It's an electrolyzer now."],
      ['juno', '那牠還叫阿喘嗎？', 'Is it still called Wheezy?'],
      ['teo', '當然。升官又不用改名。', "Of course. You don't change your name when you get promoted."],
      ['mara', '剩下的氫氣……大家先別點火。', 'As for the leftover hydrogen... nobody light a match.'],
    ],
    log: ['提歐把阿喘改建成電解站，往地底冰層鑽井。他說升官不用改名，所以牠還是阿喘。資深阿喘。', "Teo rebuilt Wheezy into an electrolyzer that drills down to the ice. He says you don't change your name when you get promoted, so it's still Wheezy. Senior Wheezy."],
  },
  'c2-elec-i': {
    lines: [
      ['ines', '改建完成。鑽頭接到冰層，冰變水、水變氧氣——這才叫工程。', 'Rebuild done. Drill into the ice, ice to water, water to oxygen. Now that is engineering.'],
      ['teo', '妳把牠的風扇拆掉了。', 'You took its fan off.'],
      ['ines', '風扇還在，我只是讓它做更有意義的事。', "The fan is still there. I just gave it something meaningful to do."],
      ['teo', '……牠還叫阿喘嗎？', '...Is it still called Wheezy?'],
      ['ines', '叫什麼都行。奇蹟不能量產，但可以升級。', "Call it whatever you like. Miracles don't scale, but they can be upgraded."],
      ['juno', '我要把這句寫進日誌！', "I'm putting that in the log!"],
    ],
    log: ['伊涅絲把阿喘改建成電解站。提歐在旁邊看了一整個下午，一直問風扇會不會痛。伊涅絲說：奇蹟不能量產，但可以升級。', "Ines rebuilt Wheezy into an electrolyzer. Teo watched all afternoon, asking whether the fan was in pain. Ines said: miracles don't scale, but they can be upgraded."],
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

  // ── 第 3 章　金屬與火 ──
  'c3-open': {
    lines: [
      ['juno', '科技研究院的掃描器一直在叫，對著……提歐的杯墊。', "The scanner in the Tech Institute keeps beeping... at Teo's coaster."],
      ['ines', '我查過了。上面的紋路是製造指令，一步一步寫得清清楚楚——只是不是人類寫的。', "I checked. The patterns are manufacturing instructions, step by step, perfectly clear. Just not written by humans."],
      ['teo', '所以我的杯墊是一本說明書？', 'So my coaster is an instruction manual?'],
      ['mara', '荒原上可能還有更多。先挖金屬、打工具，然後蓋一座探勘站，派人出去找。', "There could be more out in the wasteland. Mine metal, make tools, then build an expedition station and send people out to look."],
    ],
  },

  'c3-mine': {
    lines: [
      ['ines', '挖到了！真正的金屬礦脈。不是殘骸，不是廢料。', 'We hit it! A real metal vein. Not wreckage, not scrap.'],
      ['teo', '終於……終於不用再拆逃生艙了。', 'Finally... finally we can stop taking the escape pod apart.'],
      ['juno', '提歐在哭。', 'Teo is crying.'],
      ['teo', '是礦塵。', "It's ore dust."],
      ['mara', '這個殖民地的人，眼睛都很容易進東西。', 'People in this colony get things in their eyes a lot.'],
    ],
    log: ['我們挖到真正的金屬了。提歐說是礦塵跑進眼睛。今天大家的眼睛都進了很多礦塵。', 'We struck real metal. Teo said ore dust got in his eyes. A lot of ore dust got in a lot of eyes today.'],
  },
  'c3-forge': {
    lines: [
      ['teo', '礦場上的人，一輩子都照著別人的圖紙工作。', 'Back at the mines, we spent our whole lives working from someone else\'s blueprints.'],
      ['teo', '現在我們又照著別人的圖紙了——只是這次，沒人拿鞭子。', 'Now we\'re working from someone else\'s blueprints again. Only this time, nobody\'s holding a whip.'],
      ['ines', '……而且圖紙是我畫的。', '...And I drew the blueprints.'],
      ['teo', '妳就不能讓我感性一分鐘嗎？', 'Can you not let me be sentimental for one minute?'],
    ],
    log: ['鍛造廠點火了。提歐講了一段很感人的話，伊涅絲破壞了氣氛。兩段我都記下來了。', 'The forge is lit. Teo gave a moving speech and Ines ruined the mood. I wrote down both.'],
  },


  'c3-exp1': {
    lines: [
      ['ines', '探勘隊回來了！我們在晶簇旁邊挖到一整塊完整的晶板，還有這個——', "The expedition is back! We dug up a whole intact crystal plate next to a cluster, and this—"],
      ['juno', '石頭在發光！紫色的！可以拿來當夜燈嗎？', "The stones are glowing! Purple! Can I use them as a night light?"],
      ['ines', '那是異晶，能量密度高得嚇人。先別放在床邊。', "That's xenocrystal. The energy density is terrifying. Not by your bed."],
      ['teo', '新晶板上寫的是……濾網？氧氣濾網。', "The new plate says... a filter? An oxygen filter."],
      ['mara', '送去科技研究院。看看我們照著做，造不造得出來。', "Take it to the Tech Institute. Let's see if we can build it by following the steps."],
    ],
    log: ['第一支探勘隊回來了，帶回一張完整的藍圖和一袋會發光的紫色石頭。我想拿來當夜燈，被伊涅絲沒收了。', 'The first expedition came back with a complete blueprint and a bag of glowing purple stones. I wanted one as a night light. Ines confiscated it.'],
  },
  'c3-filter': {
    lines: [
      ['ines', '高壓濾網裝好了。產氧量多了一半。', 'The high-pressure filter is in. Oxygen output is up by half.'],
      ['juno', '所以它是怎麼運作的？', 'So how does it work?'],
      ['teo', '我會用，但不知道它為什麼會動。就像我的膝蓋。', "I can use it, but I don't know why it works. Like my knees."],
      ['ines', '……我照著藍圖一步一步做，每一步都懂，合起來就不懂了。', "...I followed the blueprint step by step. I understood every step. Put together, I don't."],
      ['mara', '那就先用著。總有一天會懂的。', "Then we use it for now. Someday we'll understand."],
    ],
    log: ['我們照著外星人的藍圖造出了高壓濾網。提歐說：「我會用，但不知道它為什麼會動。就像我的膝蓋。」', 'We built a high-pressure filter from an alien blueprint. Teo said: "I can use it, but I don\'t know why it works. Like my knees."'],
  },
  'c3-resonance': {
    lines: [
      ['juno', '三片碎片拼起來了！剛好卡在一起，一點縫都沒有。', 'The three fragments fit together! Perfectly, not even a seam.'],
      ['ines', '是工具的製造方法。敲下去的時候會跟材料共振……能省下不少料。', 'It is a way to make tools. They resonate with the material when you strike... it saves a lot of stock.'],
      ['teo', '連我的扳手都會嫉妒。', 'Even my wrench is going to be jealous.'],
    ],
    log: ['探勘隊帶回的三片碎片拼成了第二張藍圖：共振工具。提歐的扳手看起來有點失落。', "The three fragments the expeditions found fit into a second blueprint: Resonance Tools. Teo's wrench looks a little down."],
  },
  'c3-outpost': {
    lines: [
      ['juno', '前哨站的收音機收到怪聲音……像雜訊，但是有節奏。', 'The outpost radio is picking up something strange... like static, but with a rhythm.'],
      ['ines', '給我聽聽。……這個波形，和晶板上的紋路一模一樣。', 'Let me hear. ...That waveform matches the patterns on the crystal plate exactly.'],
      ['teo', '我的杯墊在跟人聊天？', 'My coaster is chatting with someone?'],
      ['mara', '訊號從哪裡來？', 'Where is it coming from?'],
      ['juno', '東邊，很遠。好像……一直都在那裡。', 'The east. Far away. Like it has... always been there.'],
    ],
    log: ['前哨站的收音機收到一段有節奏的雜訊，波形和提歐的杯墊一樣。我今晚大概睡不著了。', "The outpost radio caught a rhythmic static, the same waveform as Teo's coaster. I don't think I'll sleep tonight."],
  },
  'c3-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 天。', 'Colony log, day {day}.'],
      ['juno', '我們找到了別人留下的藍圖。照著做就造得出來，但沒有人懂為什麼。', 'We found blueprints someone else left behind. Follow them and the thing gets built, but nobody understands why.'],
      ['juno', '東邊的訊號還在響。睡前我會對著窗外說晚安，以防萬一。', 'The signal in the east is still going. Before bed I say goodnight out the window. Just in case.'],
    ],
    log: ['我們找到了別人留下的藍圖。照著做就造得出來，但沒有人懂為什麼。東邊的訊號還在響。', 'We found blueprints someone else left behind. Follow them and the thing gets built, but nobody understands why. The signal in the east is still going.'],
  },


  // ── 第 4 章　異晶 ──
  'c4-open': {
    lines: [
      ['mara', '前哨站回報：荒原上有東西在看著我們。', 'Outpost report: something out on the flats is watching us.'],
      ['juno', '牠們好小！像貓一樣，背上還會發光……而且一直盯著倉庫裡那袋異晶。', "They're so small! Like cats, and their backs glow... and they keep staring at the bag of xenocrystal in storage."],
      ['ines', '數量很多。而且牠們在學我們巡邏的路線。', "There are a lot of them. And they're learning our patrol routes."],
      ['mara', '建陸戰隊營區。我不想開第一槍，但也不想被咬。', "Build a marine barracks. I don't want to fire first, but I don't want to get bitten either."],
    ],
  },
  'c4-sefa': {
    lines: [
      ['sefa', '你們好！我是賽法，生物學家，跟著最新一批移民來的。請問微光獸在哪裡？', "Hello! I'm Sefa, biologist, just arrived with the latest settlers. Where are the glimmers?"],
      ['juno', '妳……是專程來看牠們的？', "You... came here to see them?"],
      ['sefa', '當然！這顆星球上唯一的原生動物，你們卻只想著怎麼打牠們。', 'Of course! The only native animals on this planet, and all you think about is fighting them.'],
      ['teo', '牠們咬壞了我三條電纜。', 'They chewed through three of my cables.'],
      ['sefa', '那是好奇心！電纜是很有趣的東西。', 'That is curiosity! Cables are very interesting things.'],
    ],
    log: ['新來的賽法博士是生物學家。她問的第一個問題是微光獸在哪裡，第二個問題也是。', 'The new arrival, Dr. Sefa, is a biologist. Her first question was where the glimmers are. So was her second.'],
  },
  'c4-synth': {
    lines: [
      ['ines', '異晶合成室運轉了。這東西的能量密度是電池的一百倍。', 'The crystal synthesizer is running. The energy density is a hundred times a battery.'],
      ['sefa', '等等，你們注意到了嗎？合成室一開，晶簇那邊的光就變亮了。', 'Wait, did you notice? The moment it started, the crystal clusters got brighter.'],
      ['mara', '那代表什麼？', 'What does that mean?'],
      ['sefa', '代表牠們感覺得到。我們在動牠們家裡的東西。', 'It means they can feel it. We are taking things from their home.'],
    ],
    log: ['異晶合成室開工了。賽法博士一直盯著晶簇的方向看，眉頭沒放開過。', 'The crystal synthesizer started up. Dr. Sefa kept staring toward the crystal clusters, frowning the whole time.'],
  },
  'c4-raid1': {
    lines: [
      ['mara', '大家都還好嗎？', 'Is everyone okay?'],
      ['juno', '陸戰隊說牠們撤得很快，像是……只是來看看。', 'The marines say they pulled back fast. Like they were... just checking on us.'],
      ['sefa', '牠們在試探。晶簇是牠們的育幼巢，我們蓋得越近，牠們越緊張。', 'They are testing us. The crystal clusters are their nurseries. The closer we build, the more nervous they get.'],
      ['teo', '那我們搬家？', 'So do we move?'],
      ['mara', '搬不了。但我們可以學著當好鄰居——至少，當個不那麼吵的鄰居。', "We can't. But we can learn to be good neighbors. Or at least, quieter ones."],
    ],
  },
  'c4-med': {
    lines: [
      ['ines', '醫療艙好了。以後受傷的人不用再躺在工具間。', "The med bay is done. No more patching people up in the tool shed."],
      ['teo', '工具間很舒服啊。', "The tool shed is comfy."],
      ['ines', '你是唯一一個躺在扳手上還睡得著的人。', "You're the only person who can sleep on a pile of wrenches."],
    ],
  },
  'c4-end': {
    lines: [
      ['sefa', '朱諾，我可以在日誌上寫一句嗎？', 'Juno, may I write one line in the log?'],
      ['juno', '當然！', 'Of course!'],
      ['sefa', '「牠們不是怪物。我們才是闖進別人家的那個。」', '"They are not monsters. We are the ones who walked into someone else\'s home."'],
      ['juno', '……這句好重。', "...That's heavy."],
      ['sefa', '那就記下來，然後記得對牠們好一點。', 'Then write it down, and remember to be kind to them.'],
    ],
    log: ['賽法博士在日誌上寫了一句：「牠們不是怪物。我們才是闖進別人家的那個。」', 'Dr. Sefa wrote one line in the log: "They are not monsters. We are the ones who walked into someone else\'s home."'],
  },

  // ── 第 5 章　企業的影子 ──
  'c5-open': {
    lines: [
      ['juno', '軌道上那艘船……是赫利昂的。', 'That ship in orbit... it\'s Helion\'s.'],
      ['teo', '我這輩子最不想再看到的標誌。', 'The last logo I ever wanted to see again.'],
      ['mara', '他們沒開火，只發來一份文件：開採權、欠款、利息。', "They didn't open fire. They just sent a document: mining rights, debts, interest."],
      ['ines', '他們連我們的空氣也算進去了嗎？', 'Did they bill us for our air too?'],
      ['mara', '……第 47 條附則 C。有。', '...Clause 47, Appendix C. Yes.'],
    ],
  },
  'c5-voss': {
    lines: [
      ['juno', '東邊有一架穿梭機墜毀了！上面有赫利昂的標誌……只有一個人活著。', 'A shuttle crashed to the east! Helion markings... only one survivor.'],
      ['voss', '咳……先說清楚，我不是來收帳的。', '*cough* ...Let me be clear. I am not here to collect.'],
      ['teo', '我認得你。沃斯監工，第七礦區。', 'I know you. Overseer Voss. Mining Sector Seven.'],
      ['voss', '前監工。公司不需要一個會算帳、又會問問題的人。所以我在那架穿梭機上，而不是在指揮艦上。', 'Former overseer. The company has no use for someone who does the math and asks questions. Hence the shuttle, rather than the flagship.'],
      ['mara', '你可以留下。但在這裡，你得跟大家一樣工作。', 'You can stay. But here, you work like everyone else.'],
      ['voss', '以效率而言，這是合理的人力配置。……謝謝。', 'From an efficiency standpoint, that is a sound allocation of labor. ...Thank you.'],
    ],
    log: ['一架赫利昂的穿梭機墜毀了，唯一的生還者是提歐以前的監工沃斯。提歐整晚都沒說話。', "A Helion shuttle crashed. The only survivor is Voss, Teo's old overseer. Teo didn't say a word all night."],
  },
  'c5-charter': {
    lines: [
      ['mara', '第一條憲章通過了。我們有法律了。', 'The first charter passed. We have laws now.'],
      ['juno', '我提議再加一條：不准吃別人的藻類。', "I move we add one more: no eating other people's algae."],
      ['teo', '附議。', 'Seconded.'],
      ['voss', '從法律結構來看，這條執行成本極低、民意支持度極高。我支持。', 'Structurally, that law has minimal enforcement cost and overwhelming public support. I am in favor.'],
      ['juno', '沃斯剛剛是在開玩笑嗎？', 'Was Voss just joking?'],
      ['voss', '我從不開玩笑。', 'I never joke.'],
    ],
    log: ['我們有法律了。第一條（非正式、但全體同意）：不准吃別人的藻類。', "We have laws now. Article one (unofficial, but unanimous): no eating other people's algae."],
  },
  'c5-envoy': {
    lines: [
      ['calder', '感謝各位撥冗。根據契約第 47 條附則 C，你們撿到的一切，包括空氣，都屬於公司資產。', 'Thank you for your time. Under Clause 47, Appendix C, everything you have salvaged, air included, is company property.'],
      ['mara', '空氣是我們自己造的。', 'We made that air ourselves.'],
      ['calder', '用的是公司的逃生艙零件。附則 D 有寫。', 'Using company escape pod parts. See Appendix D.'],
      ['voss', '附則 D 三年前修訂過，零件折舊後所有權歸使用者。', 'Appendix D was amended three years ago. Depreciated parts become the property of the user.'],
      ['calder', '……沃斯先生，真是意外的重逢。', '...Mr. Voss. What an unexpected reunion.'],
      ['voss', '我也很意外，你還在用舊版契約。', "Equally unexpected that you're still using the old contract."],
    ],
    log: ['卡爾德使者來了，寫字板上夾著一疊契約。沃斯當場指出三個錯誤。我開始有點喜歡沃斯了。', 'Envoy Calder arrived with a stack of contracts on his clipboard. Voss pointed out three errors on the spot. I am starting to like Voss.'],
  },
  'c5-secret': {
    lines: [
      ['voss', '有件事你們該知道。赫利昂追到這裡，不是為了幾個逃跑的礦工。', 'There is something you should know. Helion did not come all this way for a few runaway miners.'],
      ['mara', '那是為了什麼？', 'Then what for?'],
      ['voss', '為了你們的藍圖。公司找這種晶板找了幾十年。', 'For your blueprints. The company has hunted for plates like these for decades.'],
      ['ines', '所以那些藍圖……不是這顆星球的？', 'So those blueprints... are not from this planet?'],
      ['voss', '不是任何人類的。誰手上的藍圖多，誰就能造出別人造不出的東西。公司想把它們全部拿走。', 'Not from any human. Whoever holds the most blueprints can build what no one else can. The company wants every one of them.'],
      ['teo', '……我以後用它的時候，墊一張紙好了。', "...I'll put a napkin under my mug from now on."],
    ],
    log: ['沃斯說，赫利昂追到這裡，是為了我們的藍圖。公司找它們找了幾十年。提歐現在用杯墊的時候會墊一張紙。', "Voss says Helion came all this way for our blueprints. The company has hunted for them for decades. Teo now puts a napkin under his mug."],
  },
  'c5-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 天。', 'Colony log, day {day}.'],
      ['juno', '我們有法律、有貿易，還有一個會引用條款反擊企業的前監工。', 'We have laws, trade, and a former overseer who fights the company with its own fine print.'],
      ['juno', '還有一個秘密：這顆星球上，有別人留下的東西。', 'And a secret: someone else left things behind on this planet.'],
      ['mara', '穹頂明天合攏。今晚，大家早點睡。', 'The dome closes tomorrow. Everyone, get some sleep tonight.'],
    ],
    log: ['我們有法律、有貿易，還有一個會引用條款反擊企業的前監工。還有一個秘密：這顆星球上，有別人留下的東西。', 'We have laws, trade, and a former overseer who fights the company with its own fine print. And a secret: someone else left things behind on this planet.'],
  },

  // ── 第 6 章　信標 ──
  'c6-open': {
    lines: [
      ['juno', '穹頂合攏了……空氣感測器全部綠燈。', 'The dome is sealed... every air sensor is green.'],
      ['ines', '理論上，現在可以在戶外摘下頭盔了。', 'In theory, we can take our helmets off outside now.'],
      ['teo', '理論上？妳先。', 'In theory? After you.'],
      ['mara', '……我來。', "...I'll go."],
      ['juno', '瑪拉？', 'Mara?'],
      ['mara', '別哭，會浪費水分。', "Don't cry. It wastes water."],
      ['juno', '妳才是在哭的那個！', "You're the one crying!"],
    ],
    log: ['穹頂合攏的那天，我們第一次在戶外摘下頭盔。瑪拉叫大家別哭，然後自己哭了。', 'The day the dome closed, we took off our helmets outdoors for the first time. Mara told everyone not to cry, then cried.'],
  },
  'c6-governor': {
    lines: [
      ['voss', '總督府落成。從組織架構來看，這代表殖民地正式有了領導者。', 'The Governor\'s Hall is complete. Organizationally, this means the colony now has an official leader.'],
      ['juno', '那是誰？', 'Who?'],
      ['teo', '還用問嗎。', 'Do you even need to ask?'],
      ['mara', '……我只是負責開逃生艙的。', '...I just flew the escape pod.'],
      ['ines', '然後妳把我們全部帶到了這裡。', 'And then you brought all of us here.'],
    ],
  },
  'c6-beacon1': {
    lines: [
      ['ines', '信標第一段完成。它一開機就自動對上了一個頻率——', 'Beacon stage one is done. The moment it powered on, it locked onto a frequency—'],
      ['juno', '是東邊那個訊號！', "It's the signal from the east!"],
      ['sefa', '而且晶簇在回應它。全部一起亮起來了。', 'And the crystal clusters are answering it. All of them, lighting up together.'],
      ['voss', '公司的資料裡沒有這個。', 'None of this is in the company files.'],
    ],
  },
  'c6-lastlight': {
    lines: [
      ['juno', '訊號解碼了。是一艘船……一百年前墜毀在這裡的殖民船，叫「末光號」。', 'The signal is decoded. It\'s a ship... a colony ship that crashed here a hundred years ago. The Lastlight.'],
      ['mara', '還有人活著嗎？', 'Is anyone still alive?'],
      ['juno', '只有船上的 AI 還在廣播，重播最後一篇日誌。他們也是追著藍圖來的。', 'Only the ship\'s AI, still broadcasting, replaying the final log. They came for the blueprints too.'],
      ['sefa', '然後呢？', 'And then?'],
      ['juno', '……他們選擇和微光獸開戰。最後一個人也沒留下。', '...They chose to go to war with the glimmers. Not one of them was left.'],
      ['teo', '我們不會變成那樣。', "We won't end up like that."],
      ['mara', '不會。因為我們會記得他們。朱諾，寫下來。', "No. Because we'll remember them. Juno, write it down."],
    ],
    log: ['末光號，一百年前的殖民船。他們也追著藍圖來，選擇了戰爭，最後全滅。我們會記得他們。', 'The Lastlight, a colony ship from a hundred years ago. They came for the blueprints too, chose war, and none survived. We will remember them.'],
  },
  'c6-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 天。', 'Colony log, day {day}.'],
      ['juno', '信標亮起的那一刻，每一張藍圖同時發光，指向星圖上同一個座標。', 'The moment the beacon lit, every blueprint glowed at once, pointing to the same coordinates on the star map.'],
      ['voss', '那個座標上什麼都沒有。至少，公司的地圖上沒有。', 'There is nothing at those coordinates. Not on any company map, at least.'],
      ['sefa', '也許是他們。留下藍圖的那些人。', 'Maybe it is them. Whoever left the blueprints.'],
      ['teo', '他們知道我們在這裡了。', 'They know we are here now.'],
      ['mara', '那就讓他們知道——這裡住著一群自己造空氣的人。', 'Then let them know: the people here make their own air.'],
      ['juno', '家不是你降落的地方，是你決定留下來的地方。', 'Home is not where you land. It is where you decide to stay.'],
    ],
    log: ['信標亮了。每一張藍圖同時發光，指向同一個座標。他們知道我們在這裡了。家不是你降落的地方，是你決定留下來的地方。', 'The beacon is lit. Every blueprint glowed at once, pointing to the same coordinates. They know we are here now. Home is not where you land. It is where you decide to stay.'],
  },
};
