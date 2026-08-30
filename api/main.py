# ============================================================================
# المحرك الرسمي لمنصة Educational platform (Backend - Python Flask on Vercel)
# ============================================================================

import os
import re
import json
import time
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# تفعيل الـ CORS للسماح للمتصفح بالاتصال بالسيرفر
CORS(app)

def get_gemini_url():
    # جلب مفتاح الـ API من متغيرات البيئة في Vercel
    key = os.environ.get("GEMINI_API_KEY", "")
    return (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    )

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.get_json()
        
        # --- الإضافة الجذرية لحل مشكلة المعلم التفاعلي (الشات) ---
        action = data.get('action')
        if action == 'chat':
            message = data.get('message', '')
            context = data.get('context', '')
            strict_prompt = data.get('strict_prompt_command', '')

            chat_prompt = f"{strict_prompt}\n\n"
            chat_prompt += f"معلومات الدرس المرفوع:\n{context}\n\n"
            chat_prompt += f"سؤال الطالب:\n{message}"

            payload = {
                "contents": [{"parts": [{"text": chat_prompt}]}]
            }

            url = get_gemini_url()
            response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload)
            response_data = response.json()
            
            if 'candidates' not in response_data:
                 return jsonify({"error": f"خطأ من جوجل: {str(response_data)}"}), 500
                 
            ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']
            
            # الرد بـ reply كما يتوقعه ملف java.js
            return jsonify({"reply": ai_reply}), 200
        # --------------------------------------------------------

        # استكمال كود تحليل الصور والامتحانات (كما هو بدون حذف)
        images_base64 = data.get('images_base64', [])
        if not images_base64 and data.get('image_base64'):
            images_base64 = [data.get('image_base64')]
            
        subject_title = data.get('subject')
        grade_year = data.get('year')
        mime_type = data.get('mime_type', 'image/jpeg')
        prompt_command = data.get('strict_prompt_command', '')

        # إنشاء رقم جلسة فريد لضمان عدم تكرار الأسئلة في كل طلب جديد
        session_id = int(time.time())

        # هندسة البرومبت الصارم (4 أسئلة لكل قسم = 12 إجمالي لمنع قطع الـ JSON مع الشرح المباشر المركز)
        prompt = "أنت الآن 'رئيس لجنة وضع الامتحانات' و'خبير المناهج التعليمية الأول' في منصة Educational platform.\n"
        prompt += f"رقم الجلسة الفريد: {session_id} (تنبيه إجباري: قم بتوليد أسئلة جديدة ومختلفة تماماً عن أي محاولة سابقة لنفس الدرس).\n"
        if prompt_command:
             prompt += f"\nتوجيهات إضافية من النظام: {prompt_command}\n\n"
        prompt += "الهدف: تحليل محتوى الصور المرفوعة بدقة متناهية واستخراج بنك أسئلة شامل ومتدرج الصعوبة (سهل، متوسط، معقد)، مع ذكر الأسباب العلمية المباشرة والمركزة لكل إجابة.\n\n"
        prompt += "قواعد وأوامر صارمة وإجبارية لا تقبل الاستثناء أو الاختصار أبداً:\n"
        prompt += "1. قسم الاختيار من متعدد (MCQ): استخرج 4 أسئلة فقط متدرجة الصعوبة (سهل، متوسط، معقد). كل سؤال يحتوي على 4 اختيارات في options، والإجابة الصحيحة في a. في خانة reason اذكر السبب العلمي المباشر والمركز في سطرين كحد أقصى (لماذا هذه الإجابة صحيحة وباقي الاختيارات خطأ).\n"
        prompt += "2. قسم الصح والخطأ (TF): استخرج 4 أسئلة فقط متدرجة الصعوبة (سهل، متوسط، معقد). كتابة العبارة في q، والحكم عليها (صحيحة / خطأ) في a. في خانة reason اذكر السبب العلمي المباشر في سطرين كحد أقصى (لماذا هي صحيحة علمياً، أو لماذا هي خطأ وما هو التصحيح).\n"
        prompt += "3. قسم الأسئلة المقالية (Essay): استخرج 4 أسئلة فقط مقالية مركزة ومتدرجة الصعوبة (سهل، متوسط، معقد) مع إجابة نموذجية وافية في a وشرح مباشر في reason.\n"
        prompt += "4. الحد الأدنى والأقصى الإجمالي للأسئلة هو 12 سؤالاً فقط (4 لكل قسم). إياك أن تتخطى هذا العدد لضمان إغلاق تنسيق الـ JSON بشكل صحيح بالكامل وبدون أي انقطاع.\n"
        prompt += "5. تنبيه هام جداً: يجب أن يكون الشرح في reason موجزاً ومباشراً في الصميم لعدم تجاوز الحد الأقصى للنصوص المسموح بها وتجنب قطع الملف.\n"
        prompt += "6. اكتب فقرة واحدة (من 3 إلى 4 أسطر) في brief_explanation تلخص الدرس بأسلوب مشوق للروبوت.\n"
        prompt += "7. تنبيه تقني حرج: تأكد من أن الرد يتبع تنسيق JSON سليم 100%، وإياك وضع فاصلة زائدة (Trailing Comma) في آخر العناصر.\n\n"
        prompt += "يجب أن يكون الرد مصفوفة (JSON Object) متوافقة تماماً مع هذا التنسيق وبدون أي نصوص إضافية:\n"
        prompt += "{\n"
        prompt += "  \"brief_explanation\": \"اكتب الشرح المبسط هنا\",\n"
        prompt += "  \"qa_list\": [\n"
        prompt += "    {\"type\": \"MCQ\", \"q\": \"نص السؤال\", \"options\": [\"أ\", \"ب\", \"ج\", \"د\"], \"a\": \"الإجابة الصحيحة\", \"reason\": \"السبب العلمي المباشر لاختيار الإجابة ولماذا الباقي خطأ\"},\n"
        prompt += "    {\"type\": \"TF\", \"q\": \"نص العبارة\", \"a\": \"صحيحة أو خطأ\", \"reason\": \"هي صح ليه علمياً، أو غلط ليه وإيه التصحيح\"},\n"
        prompt += "    {\"type\": \"Essay\", \"q\": \"نص السؤال المقالي\", \"a\": \"الإجابة النموذجية المفصلة\", \"reason\": \"الشرح العلمي المباشر\"}\n"
        prompt += "  ]\n"
        prompt += "}\n\n"
        prompt += f"المادة: {subject_title}\n"
        prompt += f"الصف: {grade_year}"

        parts = [{"text": prompt}]
        for img_b64 in images_base64:
            parts.append({"inlineData": {"mimeType": mime_type, "data": img_b64}})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "maxOutputTokens": 8192,
                "temperature": 0.4
            }
        }

        url = get_gemini_url()
        response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload)
        response_data = response.json()
        
        if 'candidates' not in response_data:
             return jsonify({"error": f"خطأ من جوجل: {str(response_data)}"}), 500
             
        ai_response_text = response_data['candidates'][0]['content']['parts'][0]['text']
        clean_json = ai_response_text.replace("```json", "").replace("```", "").strip()
        
        # تنظيف الفواصل الزائدة تلقائياً لمنع أي خطأ JSON
        clean_json = re.sub(r',\s*([\]}])', r'\1', clean_json)
        
        result_json = json.loads(clean_json)
        qa_array = result_json.get("qa_list", [])
        brief_explanation = result_json.get("brief_explanation", "تم تحليل الدرس بنجاح.")

        return jsonify({
            "subjectTitle": subject_title, 
            "grade": grade_year, 
            "qa_data": qa_array,
            "brief_explanation": brief_explanation
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/chat', methods=['POST', 'OPTIONS'])
@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.get_json()
        subject = data.get('subject')
        year = data.get('year')
        teacher_style = data.get('teacher_style', '')
        lesson_context = data.get('lesson_context', '')
        message = data.get('message')

        chat_prompt = "أنت مساعد تعليم ذكي بمنصة Educational platform.\n"
        chat_prompt += f"المادة: {subject}\nالصف: {year}\n"
        if teacher_style:
            chat_prompt += f"أسلوب المعلم في الشرح: {teacher_style}\n"
        chat_prompt += f"محتوى الدرس المرفوع: {lesson_context}\n"
        chat_prompt += "تنبيه هام: أجب على سؤال الطالب بناءً على محتوى الدرس المرفوع فقط ولا تضف معلومات من خارج المنهج.\n"
        chat_prompt += f"سؤال الطالب: {message}"

        payload = {
            "contents": [{"parts": [{"text": chat_prompt}]}]
        }

        url = get_gemini_url()
        response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload)
        response_data = response.json()
        
        if 'candidates' not in response_data:
             return jsonify({"error": f"خطأ من جوجل: {str(response_data)}"}), 500
             
        ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']

        return jsonify({"reply": ai_reply}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
@app.route('/api', methods=['GET'])
def health():
    return jsonify({"status": "سيرفر Educational platform يعمل بنجاح 🚀"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
