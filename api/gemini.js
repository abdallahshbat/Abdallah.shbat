export default async function handler(req, res) {
  // السماح بطلبات POST فقط
  if (req.method !== "POST") {
    return res.status(200).json({ text: "خطأ: الطريقة غير مسموحة" });
  }

  try {
    const { prompt, systemPrompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // التأكد من وجود المفتاح
    if (!apiKey) {
      return res.status(200).json({ text: "تنبيه النظام: مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير موجود في Vercel." });
    }

    // تم الإصلاح هنا: إضافة -latest لاسم النموذج
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt || "" }] }
        })
      }
    );

    const data = await response.json();

    // إذا رفضت جوجل الطلب، سنعرض رسالة جوجل
    if (!response.ok) {
      const errorMessage = data.error?.message || "خطأ غير معروف من جوجل";
      return res.status(200).json({ text: `رسالة من سيرفر جوجل 🔴: ${errorMessage}` });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ text });

  } catch (error) {
    return res.status(200).json({ text: `خطأ في الشبكة الداخلية: ${error.message}` });
  }
}
