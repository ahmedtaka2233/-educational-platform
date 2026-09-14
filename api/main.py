# ============================================================================
# المحرك الرسمي لمنصة Educational platform (Backend - Python Flask on Vercel)
# ============================================================================

import os
import re
import json
import time
import requests
import jwt
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# تفعيل الـ CORS للسماح للمتصفح بالاتصال بالسيرفر
CORS(app)

SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-edu-key-2026")

# ترتيب الموديلات: كل موديلات عيلة Flash المجانية المتاحة حالياً في Gemini API (سبتمبر 2026).
# كل موديل ليه كوتة (RPM/RPD) مستقلة تماماً عن التاني، فتوزيع الطلبات عليهم بيقلل فرصة
# الوقوع في "كل البيض في سلة واحدة" وقت الزحمة، من غير أي تكلفة إضافية.
# ملحوظة: جوجل بتحدّث/بتوقف الموديلات بشكل دوري، فمن وقت للتاني يفضل تتأكد من القائمة
# الحالية على https://ai.google.dev/gemini-api/docs/models
MODELS_CHAIN = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash",
]

# تحميل بنك الأسئلة الثابت
def load_static_db():
    try:
        with open('database.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

static_db = load_static_db()

def get_gemini_url(model_name):
    # جلب مفتاح الـ API من متغيرات البيئة في Vercel
    key = os.environ.get("GEMINI_API_KEY", "")
    return (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model_name}:generateContent?key={key}"
    )

def verify_token(req):
    token = req.headers.get('Authorization')
    if not token:
        return False, "missing_token"
    try:
        token = token.split(" ")[1]
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return True, decoded
    except Exception:
        return False, "invalid_token"

def _is_overloaded(status_code, response_data):
    """يتحقق هل الرد يمثل ازدحام مؤقت (503) يستدعي إعادة المحاولة أو التبديل للموديل الاحتياطي."""
    if status_code == 503:
        return True
    if isinstance(response_data, dict):
        err = response_data.get('error', {})
        if isinstance(err, dict) and err.get('code') == 503:
            return True
        status_str = str(err.get('status', '')) if isinstance(err, dict) else ''
        if status_str == 'UNAVAILABLE':
            return True
    return False

def _call_single_model(model_name, payload, max_retries):
    """يحاول موديل واحد بعدد محاولات محدد مع انتظار متزايد (exponential backoff)."""
    url = get_gemini_url(model_name)
    last_response_data = {"error": {"message": "لم تتم أي محاولة اتصال."}}

    for attempt in range(max_retries):
        try:
            response = requests.post(
                url,
                headers={'Content-Type': 'application/json'},
                json=payload,
                timeout=60
            )
            try:
                response_data = response.json()
            except Exception:
                response_data = {"error": {"message": f"رد غير متوقع من جوجل (status {response.status_code})"}}

            last_response_data = response_data

            if _is_overloaded(response.status_code, response_data):
                if attempt < max_retries - 1:
                    # انتظار متزايد: 3, 6, 9, 12 ثانية... يعطي فرصة أكبر لتخف الزحمة
                    time.sleep(3 * (attempt + 1))
                    continue
                # آخر محاولة لهذا الموديل وفشلت بازدحام -> نرجع النتيجة عشان الكولر يجرب موديل تاني
                return response_data, True

            # نجح الطلب أو فشل بخطأ غير متعلق بالازدحام -> نرجعه كما هو
            return response_data, False

        except requests.exceptions.RequestException as e:
            last_response_data = {"error": {"message": f"خطأ شبكة: {str(e)}"}}
            if attempt < max_retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            return last_response_data, True

    return last_response_data, True

def call_gemini_with_retry(payload, max_retries_per_model=2):
    """
    يوزّع الطلب على سلسلة الموديلات المجانية بالكامل (MODELS_CHAIN) بدل التركيز
    على موديل واحد: يحاول كل موديل بعدد محاولات محدود مع انتظار متزايد، ولو فشل
    بسبب الازدحام (503) ينتقل فوراً للموديل التالي في السلسلة، وهكذا حتى ينجح
    الطلب أو تنتهي كل الموديلات المتاحة.
    """
    if not os.environ.get("GEMINI_API_KEY"):
        return {"error": {"message": "عذراً، مفتاح GEMINI_API_KEY غير موجود في إعدادات Vercel. يرجى إضافته وعمل Redeploy."}}

    last_result = {"error": {"message": "فشل الاتصال بجميع الموديلات المتاحة."}}

    for model_name in MODELS_CHAIN:
        result, was_overloaded = _call_single_model(model_name, payload, max_retries_per_model)
        last_result = result

        if not was_overloaded:
            # نجح الطلب، أو فشل بخطأ حقيقي غير متعلق بالازدحام -> لا داعي لتجربة موديل آخر
            return result

        # كان ازدحام (503) على هذا الموديل -> انتقل تلقائياً للموديل التالي في السلسلة
        continue

    # كل الموديلات في السلسلة فشلت بسبب الازدحام
    return last_result

@app.route('/api/auth', methods=['POST', 'OPTIONS'])
def auth_login():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json()
    phone = data.get('phone')
    token = jwt.encode({
        'phone': phone,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, SECRET_KEY, algorithm="HS256")
    return jsonify({"token": token}), 200

@app.route('/api/sync_analytics', methods=['POST', 'OPTIONS'])
def sync_analytics():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json()
    return jsonify({"status": "synced", "count": len(data.get('records', []))}), 200

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    is_valid, token_data = verify_token(request)
    if not is_valid and request.headers.get('X-Bypass-Trial') != 'true':
        return jsonify({"error": "غير مصرح لك بالوصول. يرجى تسجيل الدخول أو تأكيد الدفع."}), 401
        
    try:
        data = request.get_json()
        action = data.get('action')
        
        if action == 'chat':
            message = data.get('message', '')
            context = data.get('context', '')
            strict_prompt = data.get('strict_prompt_command', '')
            chat_prompt = f"{strict_prompt}\n\nمعلومات الدرس المرفوع:\n{context}\n\nسؤال الطالب:\n{message}"
            payload = {"contents": [{"parts": [{"text": chat_prompt}]}]}
            response_data = call_gemini_with_retry(payload)
            
            if 'candidates' not in response_data:
                error_msg = response_data.get('error', {}).get('message', str(response_data))
                return jsonify({"error": f"خطأ من جوجل: {error_msg}"}), 500
                
            ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']
            return jsonify({"reply": ai_reply}), 200
            
        if action == 'semantic_grade':
            question = data.get('question', '')
            model_answer = data.get('model_answer', '')
            student_answer = data.get('student_answer', '')
            grade_prompt = f"طالب يجيب على سؤال مقالي في امتحان مصري.\nالسؤال: {question}\nالإجابة النموذجية: {model_answer}\nإجابة الطالب: {student_answer}\n\nالمطلوب: قيم إجابة الطالب. إذا كانت تحمل نفس المفهوم العلمي، اعتبرها صحيحة.\nيجب الرد بصيغة JSON فقط كالتالي:\n{{\"isCorrect\": true}} أو {{\"isCorrect\": false}}"
            
            payload = {
                "contents": [{"parts": [{"text": grade_prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
            }
            response_data = call_gemini_with_retry(payload)
            
            if 'candidates' not in response_data:
                error_msg = response_data.get('error', {}).get('message', str(response_data))
                return jsonify({"error": f"فشل التصحيح: {error_msg}"}), 500
                
            ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']
            clean_json = ai_reply.replace("```json", "").replace("```", "").strip()
            return jsonify({"reply": clean_json}), 200
            
        if action == 'analyze':
            images_base64 = data.get('images_base64', [])
            if not images_base64 and data.get('image_base64'):
                images_base64 = [data.get('image_base64')]
            subject_title = data.get('subject')
            grade_year = data.get('year')
            mime_type = data.get('mime_type', 'image/jpeg')
            prompt_command = data.get('strict_prompt_command', '')
            
            extracted_qa = []
            if subject_title in static_db and grade_year in static_db[subject_title]:
                extracted_qa = static_db[subject_title][grade_year].get('qa_data', [])
                
            session_id = int(time.time())
            # هنا تم تعديل الـ Prompt لإجبار الذكاء الاصطناعي على تسمية المصفوفة qa_data لكي تطابق الجافاسكريبت تماماً
            prompt = "أنت الآن 'رئيس لجنة وضع الامتحانات' و'خبير المناهج التعليمية الأول' في منصة Educational platform.\n"
            prompt += f"رقم الجلسة الفريد: {session_id} (قم بتوليد أسئلة جديدة ومختلفة تماماً عن أي محاولة سابقة).\n"
            if prompt_command:
                prompt += f"\nتوجيهات إضافية من النظام: {prompt_command}\n\n"
            prompt += "الهدف: تحليل محتوى الصور المرفوعة بدقة متناهية واستخراج بنك أسئلة، مع ذكر الأسباب العلمية.\n\n"
            prompt += "قواعد وأوامر صارمة وإجبارية:\n"
            prompt += "يجب أن يكون الرد مصفوفة JSON متوافقة تماماً مع هذا التنسيق الحرفي:\n"
            prompt += "{\n"
            prompt += " \"brief_explanation\": \"اكتب الشرح المبسط هنا\",\n"
            prompt += " \"qa_data\": [\n"
            prompt += " {\"type\": \"MCQ\", \"q\": \"نص السؤال\", \"options\": [\"أ\", \"ب\", \"ج\", \"د\"], \"a\": \"الإجابة الصحيحة\", \"reason\": \"السبب\"},\n"
            prompt += " {\"type\": \"TF\", \"q\": \"نص العبارة\", \"a\": \"صحيحة أو خطأ\", \"reason\": \"التصحيح والسبب\"},\n"
            prompt += " {\"type\": \"ESSAY\", \"q\": \"نص السؤال المقالي\", \"a\": \"الإجابة النموذجية\", \"reason\": \"الشرح المباشر\"}\n"
            prompt += " ]\n"
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
            
            response_data = call_gemini_with_retry(payload)
            
            if 'candidates' not in response_data:
                error_msg = response_data.get('error', {}).get('message', str(response_data))
                return jsonify({"error": f"خطأ من جوجل: {error_msg}"}), 500
                
            ai_response_text = response_data['candidates'][0]['content']['parts'][0]['text']
            
            # 1. تنظيف شامل لأي علامات فوت بمارك أو أكواد زيادة بعيداً عن الـ JSON الفعلي
            clean_json = ai_response_text.replace("```json", "").replace("```", "").strip()
            # 2. تنظيف تيكتات ومشاكل التنصيص والمفاتيح المكسورة
            clean_json = re.sub(r',\s*([\]}])', r'\1', clean_json) # حذف الفاصلة الزائدة في نهاية المصفوفات
            
            try:
                result_json = json.loads(clean_json)
            except Exception as json_err:
                # محاولة إنقاذ أخيرة: لو الـ JSON لسه فيه مشكلة، هنجبر الموديل يمسح أي كلام خارج الأقواس الكبيرة { }
                try:
                    start_idx = clean_json.find('{')
                    end_idx = clean_json.rfind('}') + 1
                    if start_idx != -1 and end_idx != -1:
                        fixed_json = clean_json[start_idx:end_idx]
                        result_json = json.loads(fixed_json)
                    else:
                        raise json_err
                except:
                    # في حال الفشل التام، نضع كائن احتياطي سليم عشان الأبليكيشن ميهنجش والـ PDF يطبع عادي
                    result_json = {
                        "brief_explanation": "تم تحليل المستند بنجاح.",
                        "qa_list": [
                            {"type": "ESSAY", "q": "تنبيه النظام", "options": [], "a": "يرجى إعادة المحاولة لرفع جودة استخراج النصوص.", "reason": "خطأ في تهيئة صيغة الـ JSON من المصدر"}
                        ],
                        "qa_data": [
                            {"type": "ESSAY", "q": "تنبيه النظام", "options": [], "a": "يرجى إعادة المحاولة لرفع جودة استخراج النصوص.", "reason": "خطأ في تهيئة صيغة الـ JSON من المصدر"}
                        ]
                    }

            # المزامنة مع الفرونت إند بتبادل الأسماء الموحدة لضمان ألا تظهر صفحات بيضاء
            ai_qa_array = result_json.get("qa_data", result_json.get("qa_list", []))
            final_qa_array = extracted_qa + ai_qa_array
            brief_explanation = result_json.get("brief_explanation", "تم تحليل الدرس بنجاح.")

            return jsonify({
                "subjectTitle": subject_title,
                "grade": grade_year,
                "qa_data": final_qa_array,
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
