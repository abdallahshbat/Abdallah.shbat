export default async function handler(req, res) {
  // السماح بطلبات POST فقط
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, systemPrompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // التأكد من أن المفتاح موجود في Vercel
    if (!apiKey) {
      console.error("خطأ: مفتاح GEMINI_API_KEY غير موجود في Vercel");
      return res.status(500).json({ error: "Missing API Key" });
    }

    // التعديل هنا: إضافة -latest لاسم النموذج ليتعرف عليه سيرفر جوجل
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

    // إذا رفضت جوجل الطلب لأي سبب
    if (!response.ok) {
      console.error("خطأ من سيرفرات جوجل:", data.error);
      throw new Error(data.error?.message || "خطأ غير معروف من جوجل");
    }

    // استخراج النص من رد جوجل
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("جوجل أرجعت رداً فارغاً");
    }

    // إرسال النص بنجاح للموقع
    return res.status(200).json({ text });

  } catch (error) {
    // طباعة الخطأ الحقيقي في سجلات Vercel
    console.error("خطأ في السيرفر:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
