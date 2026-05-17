let spamIntervals = {}; // لتخزين المؤقت الخاص بكل مجموعة

module.exports = {
    config: {
        name: "ماغنوس",
        version: "1.0.0",
        hasPermssion: 0, // 0 للجميع، تقدر تخليه 1 لو تبي المطور بس اللي يشغله
        credits: "MAGNUS",
        description: "إرسال نص مكرر تلقائياً بناءً على عدد الثواني",
        commandCategory: "العامة",
        usages: "[تشغيل/ايقاف] [عدد الثواني]",
        cooldowns: 2
    },

    run: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const action = args[0];

        // النص المراد إرساله بدقة
        const spamMessage = `𝐴𝑈𝑇𝑂 𝑅𝐸𝑃𝐿𝑌

〢  𝐒𝐓𝐘𝐋𝐄 𝐎𝐅 𝐍𝐈𝐘𝐀𝐊𝐊  ✘  ┃ 𝐘𝐎𝐔registered 𝐌𝐎𝐓𝐇𝐄𝐑 ↓↑  🔷

┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐐  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐃  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐑  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐐  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐃  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐑  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐐  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐃  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐏  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐀  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐆  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽
┆🩸↢   ⃟⃝𝐑  ↣🩸┆ 𒆜  ◄   ☩  ┆ 🗽

╰ 𝗧𝗛𝗘 𝗘𝗡𝗗  ¦ 🧬 ¦

► 𝑇𝐻𝐸 𝑀𝐴𝐺⃢🕷ُِ𝑁𝑈𝑆 𝐼𝑆 𝐻𝐸𝑅𝐸 〢

𝗥𝗬𝗢𝗨𝗞𝗜𝗧𝗘𝗡𝗞𝗔𝗜  →  【🟣】

〡 𝐄𝐋 𝑀'𝐎𝐶𝑅𝑂 ┇  𝑻𝑯𝑬 𝑩𝑬𝑨𝑺𝑻 🕸 𝑶𝑭 𝑮𝑨𝑵𝑮𝑺 〡`;

        // حالة الإيقاف
        if (action === "ايقاف" || action === "إيقاف" || action === "stop") {
            if (spamIntervals[threadID]) {
                clearInterval(spamIntervals[threadID]);
                delete spamIntervals[threadID];
                return api.sendMessage("🛑 تم إيقاف الإرسال التلقائي بنجاح يا ماغنوس.", threadID, messageID);
            } else {
                return api.sendMessage("❌ لا يوجد إرسال تلقائي شغال حالياً في هذه المجموعة لتوقيفه.", threadID, messageID);
            }
        }

        // حالة التشغيل
        if (action === "تشغيل" || action === "start") {
            let seconds = parseInt(args[1]);
            
            // إذا لم يحدد الثواني، نجعلها 20 ثانية افتراضياً
            if (isNaN(seconds) || seconds <= 0) {
                seconds = 20;
            }

            // التحقق إذا كان الشغل يعمل مسبقاً في هذه المجموعة لمنع التداخل
            if (spamIntervals[threadID]) {
                clearInterval(spamIntervals[threadID]);
            }

            api.sendMessage(`🚀 تم تشغيل الإرسال التلقائي بنجاح! سيتم إرسال النص كل (${seconds}) ثانية.\n\n💡 لإيقافه في أي وقت أرسل: !ماغنوس ايقاف`, threadID, messageID);

            // تحويل الثواني إلى ملي ثانية
            spamIntervals[threadID] = setInterval(() => {
                api.sendMessage(spamMessage, threadID);
            }, seconds * 1000);
            
            return;
        }

        // في حال كتب الأمر غلط بدون تشغيل أو إيقاف
        return api.sendMessage("⚠️ طريقة الاستخدام الصحيحة:\n• لبدء الإرسال: !ماغنوس تشغيل 20\n• لإيقاف الإرسال: !ماغنوس ايقاف", threadID, messageID);
    }
};
