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

    // دمج التعليمات مع طلب المستخدم لتجنب أي رفض من جوجل لهيكلة البيانات
    const finalPrompt = `${systemPrompt}\n\n---\nطلب المستخدم:\n${prompt}`;

    // التحديث الأهم: استخدام الإصدار الرسمي والمستقر (v1) بدلاً من (v1beta) التجريبي
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }]
        })
      }
    );

    const data = await response.json();

    // إذا رفضت جوجل الطلب
    if (!response.ok) {
      const errorMessage = data.error?.message || "خطأ غير معروف من جوجل";
      return res.status(200).json({ text: `رسالة من سيرفر جوجل 🔴: ${errorMessage}` });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return res.status(200).json({ text: "عذراً، لم أتمكن من توليد إجابة. حاول مرة أخرى." });
    }

    return res.status(200).json({ text });

  } catch (error) {
    return res.status(200).json({ text: `خطأ في الشبكة الداخلية: ${error.message}` });
  }
}
