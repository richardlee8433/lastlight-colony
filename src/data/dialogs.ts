// 劇情對話腳本（第 1～6 章）。每句：[說話者, 中文, English]；log 是朱諾寫進殖民地日誌的那一段（{day} 換成天數）。
// 說話者是主要角色時顯示立繪；colonist／survivor／marine／youth 是沒有立繪的一般殖民者，narr 是旁白（動作描述），都用旁白樣式。
// 什麼時候播放由 engine/dialog.ts 決定；有些小場景只寫進日誌、不跳對話框（見 dialog.ts 的 journal）。這裡只放文字。
import type { CharacterId } from '../art/portraitArt';

export type Speaker = CharacterId | 'narr' | 'colonist' | 'survivor' | 'marine' | 'youth';
export type Line = [Speaker, string, string];
export interface SceneText { lines: Line[]; log?: [string, string] }

export const SCENES: Record<string, SceneText> = {
  // ── 第 1 章　墜落 ──
  'c1-open': {
    lines: [
      ['mara', '點名。還在喘氣的舉手。', "Roll call. Raise your hand if you're still breathing."],
      ['teo', '我兩隻手都舉了，多算我一口氣。', 'Both hands up. Count me for two breaths.'],
      ['juno', '我舉三隻！……好啦，有一隻是提歐的扳手。', "Three hands! ...Okay, one of them is Teo's wrench."],
      ['juno', '其他艙的人呢？', 'What about the other pods?'],
      ['mara', '（看了一眼空著的三個座位）他們有訊號器。會找到我們的。', '(glances at the three empty seats) They have beacons. They\'ll find us.'],
      ['mara', '去殘骸堆撿廢料。從現在起，我們得自己造空氣。', 'Go strip the wreckage for scrap. From now on, we make our own air.'],
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
      ['teo', '（拍了機器兩下）好孩子。來，跟大家打招呼。牠叫阿喘。', '(pats the machine twice) Good boy. Say hello, everyone. This is Wheezy.'],
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
  'c1-coaster': {
    lines: [
      ['juno', '提歐！殘骸裡有一塊板子在發光！', 'Teo! There\'s a plate glowing in the wreckage!'],
      ['teo', '（翻過來看）不是我們船上的東西。耐熱，很平，大小剛好。', '(turns it over) Not from our ship. Heat-proof, flat, just the right size.'],
      ['juno', '剛好什麼？', 'Right size for what?'],
      ['teo', '剛好當杯墊。', 'A coaster.'],
      ['mara', '……先別丟。總覺得它在看我們。', "...Don't throw it out. I feel like it's watching us."],
      ['teo', '那就讓它看我喝茶。', 'Then it can watch me drink my tea.'],
    ],
    log: ['我在殘骸裡撿到一塊會發光的晶板，現在是提歐的杯墊。瑪拉說它在看我們。我把杯子拿開時，它好像比較亮。', "I found a glowing crystal plate in the wreckage. It is now Teo's coaster. Mara says it's watching us. When I lift the mug, it seems brighter."],
  },
  'c1-algae': {
    lines: [
      ['juno', '第一桶藻類收成了！我先試吃……嗯。像濕掉的紙板。', 'First batch of algae! Let me try it... hm. Like wet cardboard.'],
      ['teo', '那叫鮮味。', "That's called umami."],
      ['juno', '好吧，至少比 F8 的配給好。', 'Fine. At least it beats the rations on F8.'],
      ['teo', '……那倒是。F8 的配給連紙板都不如。', '...True. F8 rations were worse than cardboard.'],
      ['mara', '而且它還會吐氧氣。在這裡，能吃又能呼吸的東西，就是米其林三星。', 'And it breathes out oxygen. Out here, food you can eat and breathe is a three-star restaurant.'],
    ],
    log: ['第一桶藻類。像濕掉的紙板，提歐堅持那叫鮮味。不過比 F8 的配給好，這點大家都同意。', 'First batch of algae. Tastes like wet cardboard. Teo insists that is umami. Still better than F8 rations. Everyone agrees on that.'],
  },
  // 只寫進日誌
  'c1-f8': {
    lines: [
      ['teo', '（鎖緊最後一顆螺絲）好了，這樣能多撐一陣子。', '(tightens the last bolt) There. That will hold a while longer.'],
      ['juno', '你修東西的時候好開心。', 'You look so happy when you fix things.'],
      ['teo', '在 F8，機器壞了要扣薪水。扣到後來，我們修機器修得比照顧自己還用心。', 'On F8, a broken machine came out of your pay. After a while we looked after the machines better than ourselves.'],
      ['teo', '這裡壞了，只要修好就好。沒人扣錢。', 'Here, if it breaks, you just fix it. Nobody docks you.'],
      ['juno', '那你要不要也照顧一下自己？', 'Then maybe look after yourself a little too?'],
      ['teo', '……我先修完這台。', '...After I finish this one.'],
    ],
    log: ['提歐說，在 F8 機器壞了要扣薪水，所以他們修機器修得比照顧自己還用心。我叫他也照顧一下自己。他說先修完這台。他已經修完三台了。', "Teo says that on F8 a broken machine came out of your pay, so they looked after the machines better than themselves. I told him to look after himself too. He said after this one. He has finished three since."],
  },
  'c1-assign': {
    lines: [
      ['mara', '恭喜各位，你們現在是員工了。', "Congratulations, everyone. You're employees now."],
      ['juno', '薪水呢？', "What's the pay?"],
      ['mara', '不會死。福利是明天也不會死。', 'Not dying. Benefits include not dying tomorrow, too.'],
      ['teo', '比赫利昂給的好多了。', 'Better than Helion ever gave us.'],
    ],
  },
  'c1-signal': {
    lines: [
      ['teo', '說好的舊殖民設施呢？', 'So where are these old colony facilities we were promised?'],
      ['mara', '訊號說有。訊號沒說它還在。', "The signal said there were some. It didn't say they were still standing."],
      ['juno', '通訊器偶爾還收得到，斷斷續續的，找不到是從哪裡來的。', 'The comm still picks it up now and then. On and off. I can\'t tell where it\'s coming from.'],
      ['juno', '瑪拉，妳當初為什麼決定逃？我是說，F8 的事。', 'Mara, why did you decide to run? From F8, I mean.'],
      ['mara', '……阿喘的濾網該換了。提歐，你去。', "...Wheezy's filter needs changing. Teo, go."],
      ['teo', '我昨天才換過。', 'I changed it yesterday.'],
      ['mara', '那就再換一次。', 'Then change it again.'],
    ],
    log: ['那個把我們引來這裡的訊號，偶爾還會響。我問瑪拉為什麼要逃，她叫提歐去換濾網。提歐換了兩次。', 'The signal that led us here still sounds now and then. I asked Mara why she ran. She sent Teo to change the filter. Teo changed it twice.'],
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
      ['mara', '點名。', 'Roll call.'],
      ['teo', '在。', 'Here.'],
      ['juno', '在！……瑪拉，只有三個人，妳不用每晚點。', "Here! ...Mara, there are only three of us. You don't have to do this every night."],
      ['mara', '要點。', 'I do.'],
    ],
    log: ['今晚，我們在加壓帳篷裡摘下頭盔。空氣有鐵鏽和藻類的味道，但每一口都是我們自己造的。睡前瑪拉又點了一次名。只有三個人，她還是點了。', 'Tonight we took our helmets off inside the pressurized tent. The air smells like rust and algae, but every breath of it is one we made ourselves. Before bed, Mara took roll call again. Only three of us, and she still did it.'],
  },

  // ── 第 2 章　扎根 ──
  'c2-open': {
    lines: [
      ['juno', '瑪拉！通訊器有聲音！是我們船上的頻率！', 'Mara! The comm is picking something up! It\'s our ship\'s frequency!'],
      ['mara', '哪一艙？', 'Which pod?'],
      ['juno', '聽不清楚……但有人在說話。', "I can't make it out... but someone's talking."],
      ['teo', '更多張嘴。', 'More mouths.'],
      ['mara', '還有更多肺。阿喘一台喘不過來了。我們得讓空氣夠大家分。', "And more lungs. Wheezy can't keep up alone. We need enough air to go around."],
    ],
  },
  'c2-ines': {
    lines: [
      ['mara', '妳的逃生艙上還有別人嗎？', 'Was anyone else in your pod?'],
      ['ines', '……四個。現在一個。', '...Four. Now one.'],
      ['narr', '（沉默）', '(Silence.)'],
      ['ines', '謝了。先說好，桃樂絲不外借。', 'Thanks. Ground rules: Dorothy is not for loan.'],
      ['juno', '桃樂絲是誰？', "Who's Dorothy?"],
      ['ines', '我的工具箱。她比大部分人可靠。', "My toolbox. She's more reliable than most people."],
      ['teo', '妳剛剛盯著阿喘看很久。有意見？', 'You were staring at Wheezy for a long time. Got a problem?'],
      ['ines', '有。牠很可愛，但撐不起十個人。地底下有冰層。給我岩材和零件，我幫牠裝上鑽頭，改建成電解站，把冰變成空氣。', "Yes. It's adorable, but it won't keep ten people breathing. There's ice under us. Give me stone and parts and I'll fit it with a drill and rebuild it into an electrolyzer that turns ice into air."],
      ['mara', '歡迎加入，伊涅絲。薪水是不會死。', 'Welcome aboard, Ines. The pay is not dying.'],
      ['ines', '……我聽說了。福利也是。', '...So I heard. Benefits too.'],
    ],
    log: ['我們救回了伊涅絲，還有她的工具箱桃樂絲。瑪拉問她艙裡還有沒有別人，她說四個，現在一個。然後她說：「桃樂絲不外借。」第三句是批評阿喘。提歐到現在還在生氣。', 'We rescued Ines, and her toolbox Dorothy. Mara asked if anyone else was in her pod. She said four, now one. Then she said, "Dorothy is not for loan." Her third sentence criticized Wheezy. Teo is still sulking.'],
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
  // 只寫進日誌
  'c2-upgrade': {
    lines: [
      ['ines', '這個藻類槽是誰設計的？', 'Who designed this algae vat?'],
      ['teo', '我。怎樣？', 'Me. Why?'],
      ['ines', '管線接反了兩條，濾網是用頭盔面罩改的，支架是逃生艙的座椅。', 'Two pipes are reversed, the filter is a helmet visor, and the frame is an escape pod seat.'],
      ['teo', '所以？', 'So?'],
      ['ines', '所以以手邊的材料來說……不差。', "So for what you had to work with... it's not bad."],
      ['juno', '她剛剛稱讚你耶！', 'She just complimented you!'],
      ['teo', '她說「不差」。', 'She said "not bad."'],
      ['juno', '從伊涅絲嘴裡說出來，那就是稱讚！', 'Coming from Ines, that IS a compliment!'],
    ],
    log: ['伊涅絲把藻類槽改建成生物採集站，順便說提歐的設計「不差」。提歐假裝不在意，晚餐多吃了一碗藻類。', 'Ines rebuilt the algae vat into a bio harvester and said Teo\'s design was "not bad." Teo pretended not to care, and had a second bowl of algae at dinner.'],
  },
  'c2-pop10': {
    lines: [
      ['juno', '我們十個人了！我要幫每個人取綽號。提歐是「扳手爺爺」。', "There are ten of us! I'm giving everyone nicknames. Teo is Grandpa Wrench."],
      ['teo', '……還可以。', '...Acceptable.'],
      ['juno', '伊涅絲是「桃樂絲的媽媽」。', "Ines is Dorothy's Mom."],
      ['ines', '（停了一下）……不準確，但我接受。', '(pauses) ...Inaccurate, but I accept.'],
      ['juno', '瑪拉是「冷面機長」。', 'Mara is Captain Frosty.'],
      ['mara', '駁回。', 'Denied.'],
      ['juno', '「冷面機長」駁回了她的綽號。已記錄。', 'Captain Frosty has denied her nickname. Noted.'],
    ],
    log: ['我們有十個人了。我幫大家取了綽號，只有冷面機長不接受。', 'There are ten of us now. I gave everyone nicknames. Only Captain Frosty refused hers.'],
  },
  // 只寫進日誌
  'c2-rescue': {
    lines: [
      ['mara', '你是哪一艙的？', 'Which pod were you on?'],
      ['survivor', '（喘著氣）五號艙……還是六號？我不記得了。', '(gasping) Pod five... or six? I don\'t remember.'],
      ['mara', '沒關係。名字？', "Doesn't matter. Name?"],
      ['narr', '（瑪拉在點名表上寫下名字，筆停在三個被劃掉又重新寫上的名字旁邊，停了很久）', '(Mara writes the name on her roll sheet. Her pen stops beside three names that were crossed out and written again, and stays there a long time.)'],
      ['juno', '瑪拉？', 'Mara?'],
      ['mara', '沒事。帶他去生活艙。', "It's nothing. Take him to the hab pod."],
    ],
    log: ['又救回一個人。瑪拉的點名表越來越長了。最上面有三個名字，被劃掉又重新寫上。我沒有問。', "We rescued someone else. Mara's roll sheet keeps getting longer. At the top are three names, crossed out and written again. I didn't ask."],
  },
  'c2-assembly': {
    lines: [
      ['ines', '提歐，你那支扳手是古董吧？桃樂絲裡隨便一支都比它好。', 'Teo, that wrench is an antique. Any tool in Dorothy beats it.'],
      ['teo', '這支扳手陪我修了三十年礦車。', 'This wrench fixed mine carts with me for thirty years.'],
      ['ines', '所以它才會那麼彎。', "That's why it's bent."],
      ['juno', '日誌：組裝工坊開張第一晚，兩位工程師為了扳手吵到天亮。', 'Log: on the assembly workshop\'s first night, two engineers argued about wrenches until dawn.'],
    ],
    log: ['組裝工坊開張第一晚，伊涅絲和提歐為了誰的扳手比較好吵到天亮。沒有人受傷。扳手除外。後來提歐睡著了，我看到伊涅絲把他的扳手拿去，偷偷校直了一點點。隔天他們都沒提。', "The assembly workshop's first night: Ines and Teo argued about whose wrench is better until dawn. No one was hurt. Except a wrench. Later, after Teo fell asleep, I saw Ines take his wrench and quietly straighten it, just a little. Neither of them mentioned it the next day."],
  },
  'c2-lounge': {
    lines: [
      ['juno', '休閒艙！我們有休閒艙了！這代表我們有「休閒」了！', 'A lounge pod! We have a lounge! That means we have leisure!'],
      ['teo', '在 F8，休閒是睡覺的另一個說法。', 'On F8, leisure was another word for sleep.'],
      ['ines', '在逃生艙裡，休閒是等死的另一個說法。', 'In an escape pod, leisure is another word for waiting to die.'],
      ['juno', '那在這裡呢？', 'And here?'],
      ['mara', '……在這裡，休閒就是休閒。', '...Here, leisure is just leisure.'],
      ['juno', '我覺得，我們好像可以在這裡待很久。', 'I think we might be able to stay here a long time.'],
    ],
    log: ['今天大家在休閒艙看了一部電影。片子是從殘骸裡撿到的，只剩後半段。沒有人在意。這是我第一次覺得，我們也許可以在這裡待很久。', 'We watched a movie in the lounge pod today. We found it in the wreckage, and only the second half survived. Nobody minded. It was the first time I felt we might be able to stay here a long time.'],
  },
  'c2-ship': {
    lines: [
      ['colonist', '伊涅絲，妳是工程師。如果收集夠多零件，我們能不能造一艘船離開？', "Ines, you're the engineer. If we gather enough parts, could we build a ship and leave?"],
      ['ines', '理論上可以。', 'In theory.'],
      ['colonist', '實際上呢？', 'And in practice?'],
      ['ines', '實際上，我們連椅子都還沒有。', "In practice, we don't even have chairs yet."],
      ['mara', '要多久？', 'How long?'],
      ['narr', '（所有人看向瑪拉）', '(Everyone turns to look at Mara.)'],
      ['ines', '……很久。妳想離開？', '...A long time. You want to leave?'],
      ['mara', '我是駕駛。我只是想知道。', "I'm a pilot. I just want to know."],
    ],
    log: ['有人問伊涅絲能不能造船離開。她說我們連椅子都還沒有。瑪拉問要多久。瑪拉從來不問沒用的問題。', "Someone asked Ines if we could build a ship and leave. She said we don't even have chairs yet. Mara asked how long. Mara never asks useless questions."],
  },
  'c2-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 天。', 'Colony log, day {day}.'],
      ['juno', '人數翻了好幾倍，但沒有人再需要數自己還剩幾口氣。', 'There are many times more of us now, and nobody has to count their breaths anymore.'],
      ['teo', '阿喘退休了嗎？', 'Did Wheezy retire?'],
      ['juno', '沒有，牠升官了。現在是資深阿喘。', 'Nope. Promoted. Senior Wheezy now.'],
      ['juno', '還有，瑪拉的點名表已經寫到第三頁了。', "Also, Mara's roll sheet is on its third page."],
      ['mara', '……點名。', '...Roll call.'],
    ],
    log: ['人數翻了好幾倍，但沒有人再需要數自己還剩幾口氣。瑪拉的點名要點很久了。她還是每晚點。', 'There are many times more of us now, and nobody has to count their breaths anymore. Mara\'s roll call takes a long time now. She still does it every night.'],
  },

  // ── 第 3 章　藍圖 ──
  'c3-open': {
    lines: [
      ['juno', '科技研究院的掃描器一直在叫，對著……提歐的杯墊。', "The scanner in the Tech Institute keeps beeping... at Teo's coaster."],
      ['ines', '我查過了。上面的紋路是製造指令，一步一步寫得清清楚楚——只是不是人類寫的。', "I checked. The patterns are manufacturing instructions, step by step, perfectly clear. Just not written by humans."],
      ['teo', '所以我的杯墊是一本說明書？', 'So my coaster is an instruction manual?'],
      ['ines', '一本很挑材料的說明書。每一步都要用到一種會發光的晶體，我們手上一顆都沒有。', "A very picky manual. Every step needs a kind of glowing crystal, and we don't have a single one."],
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
      ['teo', '在 F8，我們一輩子都照著別人的圖紙工作。', "On F8, we spent our whole lives working from someone else's blueprints."],
      ['teo', '現在我們又照著別人的圖紙了——只是這次，沒人拿鞭子。', "Now we're working from someone else's blueprints again. Only this time, nobody's holding a whip."],
      ['ines', '……而且圖紙是我畫的。', '...And I drew the blueprints.'],
      ['teo', '妳就不能讓我感性一分鐘嗎？', 'Can you not let me be sentimental for one minute?'],
    ],
    log: ['鍛造廠點火了。提歐講了一段很感人的話，伊涅絲破壞了氣氛。兩段我都記下來了。', 'The forge is lit. Teo gave a moving speech and Ines ruined the mood. I wrote down both.'],
  },
  'c3-rail': {
    lines: [
      ['juno', '軌道車開動了！我坐了一圈，從礦井到藻類槽只要一分鐘！', 'The rail cart is running! I rode a full loop. Mine to algae vats in one minute!'],
      ['ines', '運量多了一倍，工人也不用扛著礦石走路了。', 'Double the hauling, and nobody has to carry ore on their back anymore.'],
      ['teo', '在 F8，礦車是用來運礦的，不是用來載人兜風的。', 'On F8, mine carts were for ore. Not for joyrides.'],
      ['juno', '那這裡就是載人兜風的。', 'Then here they are for joyrides.'],
      ['mara', '……下次叫我。', '...Call me next time.'],
    ],
    log: ['軌道車線通了，殖民地第一次連成一整片。瑪拉說下次兜風要叫她。冷面機長想坐礦車，已記錄。', 'The rail line is open, and for the first time the colony feels like one place. Mara said to call her next time. Captain Frosty wants a cart ride. Noted.'],
  },
  'c3-exp1': {
    lines: [
      ['ines', '探勘隊回來了！我們在晶簇旁邊挖到一整塊完整的晶板，還有這個——', "The expedition is back! We dug up a whole intact crystal plate next to a cluster, and this—"],
      ['juno', '石頭在發光！紫色的！可以拿來當夜燈嗎？', "The stones are glowing! Purple! Can I use them as a night light?"],
      ['ines', '那是異晶，藍圖要的就是它。能量密度高得嚇人，而且我們只挖到這一小袋。先別放在床邊。', "That's xenocrystal. It's what the blueprints need. The energy density is terrifying, and this little bag is all we found. Not by your bed."],
      ['teo', '新晶板上寫的是……濾網？氧氣濾網。', "The new plate says... a filter? An oxygen filter."],
      ['mara', '送去科技研究院。看看我們照著做，造不造得出來。', "Take it to the Tech Institute. Let's see if we can build it by following the steps."],
      ['juno', '你們想想看，有人把說明書和材料都留在這裡，等著我們來撿。這是禮物吧！', 'Think about it. Someone left instructions and materials here, waiting for us to find them. It\'s a gift!'],
      ['ines', '從工程的角度，這是我見過最乾淨的設計。我想知道是誰畫的。', "As engineering, it's the cleanest design I have ever seen. I want to know who drew it."],
      ['mara', '沒有人會白白留下東西。', 'Nobody leaves things behind for free.'],
      ['juno', '瑪拉，妳太悲觀了。', "Mara, you're too gloomy."],
      ['mara', '在 F8，公司給我們的每一樣「禮物」，最後都寫進了帳單。', 'On F8, every "gift" the company gave us ended up on the bill.'],
      ['teo', '那這張帳單，會寄給誰？', 'Then who gets this bill?'],
      ['narr', '（沒有人回答）', '(Nobody answers.)'],
    ],
    log: ['第一支探勘隊回來了，帶回一張完整的藍圖和一小袋會發光的紫色石頭。我想拿來當夜燈，被伊涅絲沒收了。我說這是禮物，瑪拉說沒有人會白白留下東西。', 'The first expedition came back with a complete blueprint and a small bag of glowing purple stones. I wanted one as a night light. Ines confiscated it. I said it was a gift. Mara said nobody leaves things behind for free.'],
  },
  'c3-filter': {
    lines: [
      ['ines', '高壓濾網裝好了。產氧量多了一半。', 'The high-pressure filter is in. Oxygen output is up by half.'],
      ['juno', '所以它是怎麼運作的？', 'So how does it work?'],
      ['teo', '我會用，但不知道它為什麼會動。就像我的膝蓋。', "I can use it, but I don't know why it works. Like my knees."],
      ['ines', '……我照著藍圖一步一步做，每一步都懂，合起來就不懂了。', "...I followed the blueprint step by step. I understood every step. Put together, I don't."],
      ['ines', '還有一件事。裝好的那一刻，倉庫裡的異晶亮了一下。像是在……對時。', 'One more thing. The moment it went in, the xenocrystal in storage flickered. Like it was... syncing.'],
      ['mara', '危險嗎？', 'Is it dangerous?'],
      ['ines', '很微弱，連營地都傳不出去。我會記下來。', "It's very faint. It wouldn't even reach past the camp. I'll keep notes."],
      ['mara', '那就先用著。總有一天會懂的。', "Then we use it for now. Someday we'll understand."],
    ],
    log: ['我們照著外星人的藍圖造出了高壓濾網。提歐說：「我會用，但不知道它為什麼會動。就像我的膝蓋。」伊涅絲說異晶亮了一下，她記下來了。我也記下來了。', 'We built a high-pressure filter from an alien blueprint. Teo said: "I can use it, but I don\'t know why it works. Like my knees." Ines said the xenocrystal flickered. She wrote it down. So did I.'],
  },
  // 只寫進日誌
  'c3-wheezy': {
    lines: [
      ['narr', '（深夜。電解站旁只剩提歐一個人）', '(Late at night. Only Teo is left by the electrolyzer.)'],
      ['teo', '（拍了阿喘兩下）那個新濾網比你厲害，對吧。', '(pats Wheezy twice) That new filter is better than you, huh.'],
      ['teo', '外星人畫的，我看不懂。伊涅絲也看不懂。', "Aliens drew it. I can't read it. Neither can Ines."],
      ['teo', '……別擔心。他們不會丟下你的。', "...Don't worry. They won't leave you behind."],
      ['narr', '（阿喘咳了一聲）', '(Wheezy coughs.)'],
      ['teo', '嗯。我也是這麼想。', "Yeah. That's what I think too."],
    ],
    log: ['半夜起來喝水，看到提歐坐在阿喘旁邊，拍了牠兩下，跟牠說：「別擔心，他們不會丟下你的。」阿喘咳了一聲。我覺得他不是在跟阿喘說話。', 'I got up for water in the middle of the night and saw Teo sitting next to Wheezy. He patted it twice and said, "Don\'t worry. They won\'t leave you behind." Wheezy coughed. I don\'t think he was talking to Wheezy.'],
  },
  'c3-resonance': {
    lines: [
      ['juno', '三片碎片拼起來了！剛好卡在一起，一點縫都沒有。', 'The three fragments fit together! Perfectly, not even a seam.'],
      ['ines', '是工具的製造方法。敲下去的時候會跟材料共振……能省下不少料。', 'It is a way to make tools. They resonate with the material when you strike... it saves a lot of stock.'],
      ['teo', '連我的扳手都會嫉妒。', 'Even my wrench is going to be jealous.'],
    ],
    log: ['探勘隊帶回的三片碎片拼成了第二張藍圖：共振工具。提歐的扳手看起來有點失落。', "The three fragments the expeditions found fit into a second blueprint: Resonance Tools. Teo's wrench looks a little down."],
  },
  'c3-rollcall': {
    lines: [
      ['mara', '點名。……', 'Roll call. ...'],
      ['narr', '（瑪拉翻了三頁點名表，還沒點完）', '(Mara has turned three pages of the roll sheet and still isn\'t done.)'],
      ['juno', '瑪拉，二十五個人，點完天都亮了。', "Mara, there are twenty-five of us. You'll be done by sunrise."],
      ['mara', '我知道。', 'I know.'],
      ['juno', '那妳還點？', 'Then why keep doing it?'],
      ['mara', '……我記不住每個人的臉了。至少要記得名字。', "...I can't remember everyone's face anymore. At least I can remember their names."],
      ['juno', '那我幫妳。妳點前半，我點後半。', "Then I'll help. You do the first half, I'll do the second."],
      ['mara', '……好。', '...Okay.'],
    ],
    log: ['二十五個人了。瑪拉的點名要分兩個人點。她點前半，我點後半。最上面那三個名字，她每次都自己點。', 'Twenty-five of us now. Mara\'s roll call takes two people. She does the first half, I do the second. The three names at the very top, she always reads herself.'],
  },
  'c3-ship': {
    lines: [
      ['colonist', '伊涅絲，現在有金屬了，也有鍛造廠。造船的事……', 'Ines, we have metal now, and a forge. About building a ship...'],
      ['ines', '船殼可以。引擎不行。', 'The hull, yes. The engine, no.'],
      ['colonist', '差在哪？', "What's the difference?"],
      ['ines', '差在我們連引擎的圖紙都沒有。除非哪天探勘隊挖到一張。', "The difference is we don't even have plans for an engine. Unless an expedition digs one up someday."],
      ['narr', '（瑪拉停下手上的工作）', '(Mara stops what she is doing.)'],
      ['teo', '瑪拉，妳又在算要多久了。', "Mara, you're counting how long again."],
      ['mara', '我在算濾網該換了。', "I'm counting when the filter needs changing."],
    ],
    log: ['又有人問能不能造船。伊涅絲說船殼可以，引擎不行。瑪拉說她在算濾網，但她手上拿的不是濾網。', 'Someone asked again if we could build a ship. Ines said the hull, yes, the engine, no. Mara said she was counting filters, but what she was holding was not a filter.'],
  },
  'c3-outpost': {
    lines: [
      ['juno', '前哨站的收音機收到怪聲音……像雜訊，但是有節奏。', 'The outpost radio is picking up something strange... like static, but with a rhythm.'],
      ['juno', '等等。這個節奏我聽過。是當初把我們引來 K-7 的那個訊號！', "Wait. I know this rhythm. It's the signal that led us to K-7!"],
      ['ines', '給我聽聽。……這個波形，和晶板上的紋路一模一樣。', 'Let me hear. ...That waveform matches the patterns on the crystal plate exactly.'],
      ['teo', '我的杯墊在跟人聊天？', 'My coaster is chatting with someone?'],
      ['mara', '訊號從哪裡來？', 'Where is it coming from?'],
      ['juno', '東邊，很遠。好像……一直都在那裡。', 'The east. Far away. Like it has... always been there.'],
      ['mara', '（很輕地）所以它真的存在。', '(quietly) So it really exists.'],
    ],
    log: ['前哨站的收音機又收到那個訊號了，就是當初把我們引來這裡的那一個。它的波形和提歐的杯墊一樣。瑪拉說：「所以它真的存在。」我今晚大概睡不著了。', 'The outpost radio caught that signal again, the one that led us here. Its waveform matches Teo\'s coaster. Mara said, "So it really exists." I don\'t think I\'ll sleep tonight.'],
  },
  'c3-end': {
    lines: [
      ['juno', '殖民地日誌，第 {day} 天。', 'Colony log, day {day}.'],
      ['juno', '我們找到了別人留下的藍圖。照著做就造得出來，但沒有人懂為什麼。', 'We found blueprints someone else left behind. Follow them and the thing gets built, but nobody understands why.'],
      ['juno', '把我們引來的那個訊號還在響。睡前我會對著窗外說晚安，以防萬一。', 'The signal that led us here is still going. Before bed I say goodnight out the window. Just in case.'],
    ],
    log: ['我們找到了別人留下的藍圖。照著做就造得出來，但沒有人懂為什麼。把我們引來的那個訊號還在響。', 'We found blueprints someone else left behind. Follow them and the thing gets built, but nobody understands why. The signal that led us here is still going.'],
  },

  // ── 第 4 章　異晶 ──
  'c4-open': {
    lines: [
      ['ines', '合成室的藍圖我看完了。照著做，我們就能自己生產異晶。', "I've finished reading the synthesizer blueprint. If we follow it, we can make our own xenocrystal."],
      ['teo', '材料呢？', 'Materials?'],
      ['ines', '零件、金屬、工具，還有很多耐心。', 'Parts, metal, tools, and a lot of patience.'],
      ['juno', '那我們就不用再等探勘隊了！', "Then we don't have to wait for expeditions anymore!"],
      ['mara', '好。蓋。', 'Good. Build it.'],
      ['mara', '……陸戰隊營區也排進去。東西越多，越要有人守。', '...Put a marine barracks on the list too. The more we have, the more we need someone guarding it.'],
    ],
  },
  'c4-synth': {
    lines: [
      ['narr', '（合成室落成。線條像水一樣流動，外殼泛著紫光）', '(The synthesizer is finished. Its lines flow like water, and its shell glows violet.)'],
      ['juno', '這……是我們蓋的？', 'We... built this?'],
      ['teo', '我蓋的。但我不覺得它是我蓋的。', "I built it. But it doesn't feel like I built it."],
      ['ines', '每一根支架都照著藍圖，沒有一根是多餘的。我們以前蓋的東西，沒有一樣長這樣。', 'Every strut follows the blueprint. Not one is wasted. Nothing we ever built looked like this.'],
      ['mara', '能用就好。開機。', 'If it works, it works. Power it on.'],
      ['narr', '（啟動的那一刻，基地裡所有異晶同時亮起紫光，一明一暗，持續了整整一分鐘）', '(The moment it starts, every xenocrystal in the base lights up violet at once, pulsing bright and dim for a full minute.)'],
      ['juno', '它在唱歌！', "It's singing!"],
      ['ines', '它在耗電。', "It's drawing power."],
      ['juno', '伊涅絲！', 'Ines!'],
      ['ines', '……好吧。它在用一種很規律的方式耗電。上次裝濾網時只亮了一下，這次是整個基地。', '...Fine. It is drawing power in a very regular way. With the filter it only flickered once. This time it is the whole base.'],
      ['teo', '這是好事還是壞事？', 'Is that good or bad?'],
      ['ines', '我不知道。', "I don't know."],
      ['mara', '（看向晶簇的方向）那邊也在亮。', '(looking toward the crystal clusters) They\'re lighting up out there too.'],
    ],
    log: ['異晶合成室落成了。它長得不像我們蓋過的任何東西。提歐說：「我蓋的。但我不覺得它是我蓋的。」開機的時候，基地裡所有的異晶一起亮了一分鐘。我說它在唱歌，伊涅絲說它在耗電。那天晚上，荒原上的光一直沒熄。', "The crystal synthesizer is finished. It doesn't look like anything we've ever built. Teo said, \"I built it. But it doesn't feel like I built it.\" When it powered on, every xenocrystal in the base lit up for a full minute. I said it was singing. Ines said it was drawing power. That night, the lights out on the flats never went out."],
  },
  'c4-warn': {
    lines: [
      ['juno', '前哨站回報——荒原上……好多光點。從每一個晶簇的方向過來。', 'Outpost report— out on the flats... so many lights. Coming from every crystal cluster.'],
      ['mara', '多少？', 'How many?'],
      ['juno', '數不完。牠們背上在發光，像那些異晶一樣。', "Too many to count. Their backs are glowing, like the xenocrystal."],
      ['teo', '是衝著合成室來的。', "They're coming for the synthesizer."],
      ['mara', '所有人進艙。會拿武器的，跟我來。', 'Everyone inside. Anyone who can hold a weapon, with me.'],
    ],
  },
  'c4-raid1': {
    lines: [
      ['mara', '點名。', 'Roll call.'],
      ['narr', '（這次的點名很慢。有幾個名字，回答的是醫療兵。有兩個名字，沒有人回答）', '(Roll call is slow this time. For some names, the medic answers. For two names, nobody answers.)'],
      ['mara', '……再點一次。', '...Again.'],
      ['juno', '瑪拉。點幾次都一樣。', "Mara. It won't change."],
      ['juno', '兩個人沒回來。三個人重傷。還有一個……差一點就沒回來。', "Two people didn't make it. Three badly hurt. And one... almost didn't make it."],
      ['teo', '牠們只衝合成室和倉庫。旁邊的生活艙，碰都沒碰。', "They only went for the synthesizer and the storage. The hab pods right next to them, they didn't touch."],
      ['ines', '牠們知道自己要什麼。', 'They know what they want.'],
      ['mara', '那我們也要知道自己要什麼。建營區，蓋醫療艙。下一次，我們要準備好。', 'Then we need to know what we want too. Barracks. A med bay. Next time, we\'ll be ready.'],
    ],
    log: ['今天是我們第一次被攻擊。兩個人沒有回來，三個人重傷，一個人差點也沒回來。點名的時候，有兩個名字沒有人回答。瑪拉點了兩次。', "Today we were attacked for the first time. Two people didn't come back. Three were badly hurt, and one almost didn't come back either. At roll call, two names went unanswered. Mara read them twice."],
  },
  'c4-memorial': {
    lines: [
      ['juno', '紀念堂第一面牆，刻那兩個人的名字。', 'The first wall of the memorial gets those two names.'],
      ['mara', '嗯。然後把所有沒能走到這裡的人，也一起刻上。', 'Yes. And then everyone who never made it here, too.'],
      ['teo', '第七礦區的十四個。我記得他們。', 'The fourteen from Sector Seven. I remember them.'],
      ['ines', '我艙裡的三個。', 'The three from my pod.'],
      ['mara', '……還有我那一艙，三個空座位。', '...And from my pod. Three empty seats.'],
      ['narr', '（大家第一次聽瑪拉說出這件事）', '(It is the first time anyone has heard Mara say it.)'],
      ['juno', '我有名單。我一直替妳記著。', "I have the list. I've been keeping it for you."],
      ['mara', '（停了很久）……謝謝。', '(after a long pause) ...Thank you.'],
    ],
    log: ['紀念堂落成了。第一面牆是第一次襲擊沒回來的兩個人，後面是所有沒能走到這裡的人。最後三個名字，是瑪拉自己刻的。她說那是她那一艙的三個空座位，其他的什麼都沒說。', 'The memorial hall is finished. The first wall holds the two we lost in the first attack, then everyone who never made it here. Mara carved the last three names herself. She said they were the three empty seats in her pod. She said nothing else.'],
  },
  'c4-armor': {
    lines: [
      ['ines', '槍管校正好了。從 F8 帶出來的火藥武器，大概就只能做到這樣了。', "The barrels are calibrated. That's about as good as the powder guns we brought from F8 will ever get."],
      ['marine', '打得中，但牠們的殼很硬。子彈打上去會彈開。', 'We can hit them, but their shells are hard. Bullets bounce off.'],
      ['ines', '藍圖裡有一張異晶護甲，至少能讓你們挨得久一點。', 'One of the blueprints is crystal armor. At least it will let you take more hits.'],
      ['teo', '那藍圖裡有沒有……更大的東西？', 'Is there anything... bigger in the blueprints?'],
      ['ines', '有一張我看不懂的。像是把異晶的能量直接射出去。', "There's one I can't read. Something like firing xenocrystal energy straight out."],
      ['mara', '先不要。我們連合成室的副作用都還沒搞懂。', "Not yet. We don't even understand what the synthesizer did."],
    ],
  },
  'c4-teach': {
    lines: [
      ['teo', '不對不對，扳手不是這樣拿的。來，看我。', "No, no, that's not how you hold a wrench. Here, watch me."],
      ['youth', '可是藍圖上寫……', 'But the blueprint says...'],
      ['teo', '藍圖告訴你怎麼做，不會告訴你為什麼。為什麼，要用手學。', 'A blueprint tells you how. It never tells you why. Why, you learn with your hands.'],
      ['ines', '（路過）他說得對。', '(passing by) He\'s right.'],
      ['teo', '……妳剛剛說什麼？', '...What did you just say?'],
      ['ines', '我說，你的扳手還是很彎。', 'I said your wrench is still bent.'],
    ],
    log: ['提歐開始教年輕人修東西了。他說藍圖只告訴你怎麼做，不會告訴你為什麼。伊涅絲說他說得對，然後立刻假裝沒說過。', "Teo has started teaching the young ones to fix things. He says a blueprint only tells you how, never why. Ines said he was right, then immediately pretended she hadn't."],
  },
  'c4-sefa': {
    lines: [
      ['sefa', '你們好！我是賽法，生物學家。我的研究船在三個星系外收到一段訊號，很規律，不像自然現象。我就跟過來了。', "Hello! I'm Sefa, biologist. My research ship picked up a signal three systems away. Very regular, nothing natural about it. So I followed it here."],
      ['mara', '三個星系外？', 'Three systems away?'],
      ['sefa', '嗯！我一路追到這裡。請問，那些背上會發光的動物在哪裡？', 'Yes! I chased it all the way. Now, where are the animals with the glowing backs?'],
      ['juno', '妳是說微光獸？', 'You mean the glimmers?'],
      ['sefa', '你們幫牠們取了名字！太好了！', 'You named them! Wonderful!'],
      ['teo', '牠們上週咬穿了我們的合成室。', 'Last week they chewed through our synthesizer.'],
      ['sefa', '那是有原因的！所有的行為都有原因。', 'There is a reason for that! There is a reason for every behavior.'],
      ['mara', '還有誰收得到那段訊號？', 'Who else can pick up that signal?'],
      ['sefa', '（愣了一下）……任何在聽的人。', '(a beat) ...Anyone who is listening.'],
    ],
    log: ['新來的賽法博士是生物學家。她問的第一個問題是微光獸在哪裡，第二個問題也是。她說她是循著一段訊號來的。瑪拉問還有誰收得到。賽法說：任何在聽的人。', 'The new arrival, Dr. Sefa, is a biologist. Her first question was where the glimmers are. So was her second. She says she followed a signal here. Mara asked who else could hear it. Sefa said: anyone who is listening.'],
  },
  'c4-guard': {
    lines: [
      ['sefa', '你們有沒有注意到？牠們每次都只攻擊離異晶最近的地方。', 'Have you noticed? Every time, they only attack whatever is closest to the xenocrystal.'],
      ['sefa', '還有，合成室開機之前，你們看過這麼多隻嗎？', 'And before the synthesizer powered on, had you ever seen this many?'],
      ['juno', '沒有……以前只有幾隻在遠處看。', 'No... just a few, watching from far away.'],
      ['sefa', '晶簇是牠們的巢。牠們不是在獵食，是在守護。', 'The clusters are their nests. They are not hunting. They are guarding.'],
      ['ines', '守護異晶？為什麼？', 'Guarding the xenocrystal? Why?'],
      ['sefa', '我不知道。這就是我想知道的。', "I don't know. That is what I want to find out."],
      ['mara', '那我們要怎麼做？', 'So what do we do?'],
      ['sefa', '……我還沒有答案。給我時間。', "...I don't have an answer yet. Give me time."],
    ],
    log: ['賽法博士說，微光獸不是在攻擊我們，是在守護異晶。我們問為什麼，她說她也不知道。這是她第一次說「不知道」。', 'Dr. Sefa says the glimmers are not attacking us. They are guarding the xenocrystal. We asked why. She said she doesn\'t know. It was the first time she has said "I don\'t know."'],
  },
  // 只寫進日誌
  'c4-names': {
    lines: [
      ['teo', '妳幫那隻缺了一角的取名叫什麼？', 'What did you name the one with the chipped horn?'],
      ['sefa', '「缺角」。很直觀。', '"Chipped." Very descriptive.'],
      ['teo', '太隨便了。牠叫「老三」。', 'Lazy. Its name is Third.'],
      ['sefa', '為什麼是老三？', 'Why Third?'],
      ['teo', '牠第三個衝進來，第三個撤退，被打中三次還站著。', 'Third one in, third one out, took three hits and stayed standing.'],
      ['sefa', '……這個名字很好。', '...That is a good name.'],
      ['teo', '我替機器取名字三十年了。', "I've been naming machines for thirty years."],
      ['juno', '日誌：殖民地第二對吵架好朋友誕生了。', 'Log: the colony\'s second pair of best-friends-who-bicker is born.'],
    ],
    log: ['賽法博士和提歐為了一隻微光獸的名字吵了一下午。最後叫老三。賽法說這是她聽過最好的名字。提歐假裝不在意，但走路的時候有點跳。', 'Dr. Sefa and Teo argued all afternoon about a glimmer\'s name. It ended up as Third. Sefa says it\'s the best name she\'s ever heard. Teo pretended not to care, but there was a little bounce in his step.'],
  },
  'c4-med': {
    lines: [
      ['ines', '醫療艙好了。以後受傷的人不用再躺在工具間。', "The med bay is done. No more patching people up in the tool shed."],
      ['teo', '工具間很舒服啊。', "The tool shed is comfy."],
      ['ines', '你是唯一一個躺在扳手上還睡得著的人。', "You're the only person who can sleep on a pile of wrenches."],
      ['juno', '伊涅絲，妳為什麼這麼急著蓋？', 'Ines, why were you in such a hurry to build it?'],
      ['ines', '……因為我知道等救援的時候有多安靜。', '...Because I know how quiet it gets while you wait to be rescued.'],
    ],
    log: ['醫療艙落成了。我問伊涅絲為什麼這麼急著蓋。她說，因為她知道等救援的時候有多安靜。她說完就去修別的東西了。', 'The med bay is finished. I asked Ines why she was in such a hurry to build it. She said it was because she knows how quiet it gets while you wait to be rescued. Then she went off to fix something else.'],
  },
  // 只寫進日誌
  'c4-hydro': {
    lines: [
      ['juno', '水耕農場長出第一片葉子了！真的葉子！綠色的！', 'The hydroponic farm grew its first leaf! A real leaf! It\'s green!'],
      ['teo', '在 F8，我三十年沒看過活的葉子。', "On F8, I didn't see a living leaf for thirty years."],
      ['ines', '它們也會產氧。阿喘終於有同事了。', 'They make oxygen too. Wheezy finally has coworkers.'],
      ['teo', '阿喘不需要同事。', "Wheezy doesn't need coworkers."],
      ['ines', '阿喘需要休假。', 'Wheezy needs a vacation.'],
    ],
    log: ['水耕農場長出第一片真的葉子。提歐說他三十年沒看過活的葉子，然後他的眼睛又進礦塵了。這裡沒有礦。', "The hydroponic farm grew its first real leaf. Teo said he hadn't seen a living leaf in thirty years, and then he got ore dust in his eyes again. There is no ore here."],
  },
  'c4-gene': {
    lines: [
      ['sefa', '（盯著螢幕）這不對。', '(staring at the screen) This is wrong.'],
      ['ines', '什麼不對？', 'What is?'],
      ['sefa', '我分析了第一次襲擊留下的微光獸遺體。牠們的基因有一段我看不懂。', 'I analyzed the glimmer remains from the first attack. There is a section of their genome I cannot read.'],
      ['ines', '突變？', 'A mutation?'],
      ['sefa', '不是突變。突變是亂的。這段……太整齊了。', 'Not a mutation. Mutations are messy. This is... too tidy.'],
      ['mara', '代表什麼？', 'Meaning what?'],
      ['sefa', '我還不能證明任何事。（把樣本放回冷藏櫃）但我會一直看下去。', "I can't prove anything yet. (puts the sample back in the cold store) But I will keep looking."],
    ],
    log: ['賽法博士說，微光獸的基因裡有一段太整齊的東西。她還不能證明任何事。她把樣本收進冷藏櫃，鎖了兩道。', 'Dr. Sefa says there is something too tidy in the glimmers\' genes. She can\'t prove anything yet. She put the samples in the cold store and locked it twice.'],
  },
  'c4-end': {
    lines: [
      ['sefa', '朱諾，我可以在日誌上寫一句嗎？', 'Juno, may I write one line in the log?'],
      ['juno', '當然！', 'Of course!'],
      ['sefa', '「牠們不是怪物。我們才是闖進別人家的那個。」', '"They are not monsters. We are the ones who walked into someone else\'s home."'],
      ['juno', '……這句好重。', "...That's heavy."],
      ['sefa', '還有一句。「而且，牠們不是單純的野獸。牠們的行為太有規律了，像是在執行某種命令。」', 'One more. "And they are not simply animals. Their behavior is too regular. As if they are following some kind of order."'],
      ['juno', '誰的命令？', "Whose order?"],
      ['sefa', '那就是我想知道的。', 'That is what I want to find out.'],
    ],
    log: ['賽法博士在日誌上寫了兩句：「牠們不是怪物。我們才是闖進別人家的那個。」「牠們的行為太有規律了，像是在執行某種命令。」', 'Dr. Sefa wrote two lines in the log: "They are not monsters. We are the ones who walked into someone else\'s home." "Their behavior is too regular. As if they are following some kind of order."'],
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
