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
        action = data.get('action')
        
        # --------------------------------------------------------
        # 1. نظام المعلم التفاعلي (المحادثة الغامرة)
        # --------------------------------------------------------
        if action == 'chat':
            message = data.get('message', '')
            context = data.get('context', '')
            strict_prompt = data.get('strict_prompt_command', '')

            chat_prompt = f"{strict_prompt}\n\nمعلومات الدرس المرفوع:\n{context}\n\nسؤال الطالب:\n{message}"

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

        # --------------------------------------------------------
        # 2. نظام التصحيح المقالي بالذكاء الاصطناعي (Semantic Grading)
        # --------------------------------------------------------
        if action == 'semantic_grade':
            question = data.get('question', '')
            model_answer = data.get('model_answer', '')
            student_answer = data.get('student_answer', '')

            grade_prompt = f"طالب يجيب على سؤال مقالي في امتحان مصري.\n"
            grade_prompt += f"السؤال: {question}\n"
            grade_prompt += f"الإجابة النموذجية: {model_answer}\n"
            grade_prompt += f"إجابة الطالب: {student_answer}\n\n"
            grade_prompt += "المطلوب: قيم إجابة الطالب. إذا كانت تحمل نفس المفهوم العلمي أو قريبة جداً من المعنى المنطقي للإجابة النموذجية، اعتبرها صحيحة.\n"
            grade_prompt += "لا تدقق على الحرفيات أو الأخطاء الإملائية. يجب الرد بصيغة JSON فقط كالتالي:\n{\"isCorrect\": true} أو {\"isCorrect\": false}"

            payload = {
                "contents": [{"parts": [{"text": grade_prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1
                }
            }

            url = get_gemini_url()
            response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload)
            response_data = response.json()
            
            if 'candidates' not in response_data:
                 return jsonify({"error": "فشل التصحيح"}), 500
                 
            ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']
            clean_json = ai_reply.replace("```json", "").replace("```", "").strip()
            
            return jsonify({"reply": clean_json}), 200

        # --------------------------------------------------------
        # 3. نظام تحليل الدرس واستخراج بنك الأسئلة والمذكرات
        # --------------------------------------------------------
        if action == 'analyze':
            images_base64 = data.get('images_base64', [])
            if not images_base64 and data.get('image_base64'):
                images_base64 = [data.get('image_base64')]
                
            subject_title = data.get('subject')
            grade_year = data.get('year')
            mime_type = data.get('mime_type', 'image/jpeg')
            prompt_command = data.get('strict_prompt_command', '')

            session_id = int(time.time())

            prompt = "أنت الآن 'رئيس لجنة وضع الامتحانات' و'خبير المناهج التعليمية الأول' في منصة Educational platform.\n"
            prompt += f"رقم الجلسة الفريد: {session_id} (تنبيه إجباري: قم بتوليد أسئلة جديدة ومختلفة تماماً عن أي محاولة سابقة لنفس الدرس).\n"
            if prompt_command:
                 prompt += f"\nتوجيهات إضافية من النظام: {prompt_command}\n\n"
            prompt += "الهدف: تحليل محتوى الصور المرفوعة بدقة متناهية واستخراج بنك أسئلة، مع ذكر الأسباب العلمية.\n\n"
            prompt += "قواعد وأوامر صارمة وإجبارية:\n"
            prompt += "يجب أن يكون الرد مصفوفة JSON متوافقة تماماً مع هذا التنسيق:\n"
            prompt += "{\n"
            prompt += "  \"brief_explanation\": \"اكتب الشرح المبسط هنا\",\n"
            prompt += "  \"qa_list\": [\n"
            prompt += "    {\"type\": \"MCQ\", \"q\": \"نص السؤال\", \"options\": [\"أ\", \"ب\", \"ج\", \"د\"], \"a\": \"الإجابة الصحيحة\", \"reason\": \"السبب\"},\n"
            prompt += "    {\"type\": \"TF\", \"q\": \"نص العبارة\", \"a\": \"صحيحة أو خطأ\", \"reason\": \"التصحيح والسبب\"},\n"
            prompt += "    {\"type\": \"ESSAY\", \"q\": \"نص السؤال المقالي\", \"a\": \"الإجابة النموذجية\", \"reason\": \"الشرح المباشر\"}\n"
            prompt += "  ]\n"
            prompt += "}\n"

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

@app.route('/', methods=['GET'])
@app.route('/api', methods=['GET'])
def health():
    return jsonify({"status": "سيرفر Educational platform يعمل بنجاح 🚀"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
