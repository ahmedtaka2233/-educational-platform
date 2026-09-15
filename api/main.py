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

# تحميل بنك الأسئلة الثابت
def load_static_db():
    try:
        with open('database.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

static_db = load_static_db()

def get_gemini_url():
    # جلب مفتاح الـ API من متغيرات البيئة في Vercel
    key = os.environ.get("GEMINI_API_KEY", "")
    return (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/gemini-3.6-flash:generateContent?key={key}"
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

def call_gemini_with_retry(payload, max_retries=4):
    url = get_gemini_url()
    
    if not os.environ.get("GEMINI_API_KEY"):
         return {"error": {"message": "عذراً، مفتاح GEMINI_API_KEY غير موجود في إعدادات Vercel. يرجى إضافته وعمل Redeploy."}}

    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload)
            response_data = response.json()

            error_text = json.dumps(response_data, ensure_ascii=False).lower()
            # لا نعيد طلبات الحصة/معدل الاستخدام. إعادة إرسال 429 لا ترفع
            # الحد المجاني، وقد تستهلك محاولات المستخدم بلا فائدة.
            quota_error = (
                response.status_code == 429
                or "quota" in error_text
                or "free_tier" in error_text
                or "free tier" in error_text
                or "rate limit" in error_text
                or "too many requests" in error_text
                or "resource exhausted" in error_text
            )
            if quota_error:
                return response_data

            retryable_status = response.status_code in (500, 502, 503, 504)
            retryable_message = any(phrase in error_text for phrase in (
                "high demand",
                "temporarily unavailable",
                "try again later"
            ))
            if retryable_status or retryable_message:
                if attempt < max_retries - 1:
                    time.sleep(min(10, 2 ** (attempt + 1)))
                    continue
            
            return response_data
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            return {"error": {"message": str(e)}}
    return response_data

def friendly_gemini_error(response_data):
    error = response_data.get('error', {}) if isinstance(response_data, dict) else {}
    raw_message = str(error.get('message', response_data))
    normalized = raw_message.lower()
    if (
        error.get('code') == 429
        or "quota" in normalized
        or "free_tier" in normalized
        or "free tier" in normalized
        or "rate limit" in normalized
        or "too many requests" in normalized
        or "resource exhausted" in normalized
    ):
        retry_hint = re.search(r"retry in\s+([\d.]+)s", raw_message, flags=re.IGNORECASE)
        wait_text = f" انتظر حوالي {round(float(retry_hint.group(1)))} ثانية ثم جرّب مرة أخرى." if retry_hint else "انتظر قليلًا ثم جرّب مرة أخرى."
        return "تم استهلاك الحصة المجانية الحالية لخدمة الذكاء الاصطناعي." + wait_text
    if any(phrase in normalized for phrase in (
        "high demand",
        "temporarily unavailable",
        "try again later",
        "resource exhausted",
        "request too large",
        "payload too large",
        "image size",
        "maximum"
    )):
        if any(phrase in normalized for phrase in ("request too large", "payload too large", "image size", "maximum")):
            return "حجم الصور أو عددها كبير على الطلب الواحد. جرّب تقسيم الصور، والنظام الأمامي بيعمل ده تلقائياً عند الحاجة."
        return "خدمة الذكاء الاصطناعي عليها ضغط مؤقت. استنى ثواني وجرب تاني، والطلب هيتعاد تلقائياً كذا مرة قبل ظهور الرسالة دي."
    return raw_message

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
            education_track = data.get('education_track', 'general')
            stage = data.get('stage', 'غير محدد')
            branch = data.get('branch', 'غير محدد')
            year = data.get('year', 'غير محدد')
            subject = data.get('subject', 'غير محدد')
            authority = 'الأزهر الشريف' if education_track == 'azhar' else 'وزارة التربية والتعليم المصرية'
            dialect_rules = (
                "اكتب بالمصري الطبيعي اللي مدرس مصري بيشرح بيه، مش ترجمة حرفية من الفصحى. "
                "خليك على نفس مستوى بساطة وطريقة كلام الطالب؛ ما تحوّلش كلامه لصيغة رسمية أو ترجمة نصية. "
                "ممنوع الجمل الآلية والافتتاحيات المحفوظة، وممنوع تكرار يا بطل أو يا دكتور أو قشطة. "
                "خلي المصطلحات والقوانين العلمية دقيقة، واشرحها بكلام بسيط مناسب للسن. "
                "لو المسألة رياضيات، اكتب المعطيات والمطلوب والقانون وخطوات الحل والمراجعة النهائية. "
                "لو الطالب ابتدائي بسّط الأمثلة، ولو إعدادي وضّح السبب والنتيجة، ولو ثانوي أو فني اشرح نواتج التعلم وطريقة التفكير. "
                "في مواد الأزهر لا تغيّر نص الآية أو الحديث أو الدليل، وبيّن الدليل عند الحاجة."
            )
            chat_prompt = (
                f"{strict_prompt}\n\n"
                f"قواعد أسلوب الرد الإلزامية: {dialect_rules}\n"
                f"الجهة التعليمية: {authority}. المرحلة: {stage}. الصف: {year}. "
                f"الشعبة أو المسار: {branch}. المادة: {subject}.\n"
                f"معلومات الدرس المرفوع:\n{context}\n\n"
                f"سؤال الطالب:\n{message}"
            )
            payload = {
                "contents": [{"parts": [{"text": chat_prompt}]}],
                "generationConfig": {"temperature": 0.55}
            }
            response_data = call_gemini_with_retry(payload)
            
            if 'candidates' not in response_data:
                error_msg = friendly_gemini_error(response_data)
                return jsonify({"error": f"حصلت مشكلة مؤقتة في خدمة الذكاء الاصطناعي: {error_msg}"}), 503
                
            ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']
            return jsonify({"reply": ai_reply}), 200
            
        if action == 'semantic_grade':
            question = data.get('question', '')
            model_answer = data.get('model_answer', '')
            student_answer = data.get('student_answer', '')
            education_track = data.get('education_track', 'general')
            stage = data.get('stage', 'غير محدد')
            subject = data.get('subject', 'غير محدد')
            if education_track == 'azhar':
                grading_rule = "في الأزهر: المعنى الصحيح وحده يحقق جزءاً من الدرجة، وللحكم بالصحة الكاملة ابحث عن الدليل النصي أو القاعدة المطلوبة إذا كان السؤال يتطلب ذلك، مع عدم تغيير نص الدليل."
            else:
                grading_rule = "في التعليم العام: المعنى يغني عن النص الحرفي؛ اعتبر الإجابة صحيحة إذا تضمنت الفكرة المنطقية والكلمات المفتاحية أو القانون أو المصطلحات العلمية المطلوبة."
            grade_prompt = (
                f"قيّم إجابة طالب في امتحان مصري. الجهة: {'الأزهر الشريف' if education_track == 'azhar' else 'وزارة التربية والتعليم المصرية'}.\n"
                f"المرحلة: {stage}. المادة: {subject}.\n"
                f"السؤال: {question}\nالإجابة النموذجية: {model_answer}\nإجابة الطالب: {student_answer}\n\n"
                f"{grading_rule}\n"
                "أعد JSON فقط بهذا الشكل: {\"isCorrect\": true} أو {\"isCorrect\": false}."
            )
            
            payload = {
                "contents": [{"parts": [{"text": grade_prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
            }
            response_data = call_gemini_with_retry(payload)
            
            if 'candidates' not in response_data:
                error_msg = friendly_gemini_error(response_data)
                return jsonify({"error": f"فشل التصحيح: {error_msg}"}), 500
                
            ai_reply = response_data['candidates'][0]['content']['parts'][0]['text']
            clean_json = ai_reply.replace("```json", "").replace("```", "").strip()
            return jsonify({"reply": clean_json}), 200
            
        if action == 'analyze':
            images_base64 = data.get('images_base64', [])
            if not images_base64 and data.get('image_base64'):
                images_base64 = [data.get('image_base64')]
            if not isinstance(images_base64, list):
                images_base64 = [images_base64]
            if len(images_base64) > 10:
                return jsonify({"error": "مسموح بحد أقصى 10 صور في الطلب الواحد."}), 400
            include_static_db = data.get('include_static_db', True)
            subject_title = data.get('subject')
            grade_year = data.get('year')
            education_track = data.get('education_track', 'general')
            stage = data.get('stage', 'غير محدد')
            branch = data.get('branch', 'غير محدد')
            education_authority = data.get(
                'education_authority',
                'قطاع المعاهد الأزهرية ومواصفات امتحانات الأزهر الشريف'
                if education_track == 'azhar'
                else 'وزارة التربية والتعليم والتعليم الفني المصرية والمركز القومي للامتحانات'
            )
            mime_type = data.get('mime_type', 'image/jpeg')
            prompt_command = data.get('strict_prompt_command', '')
            
            extracted_qa = []
            if include_static_db and subject_title in static_db and grade_year in static_db[subject_title]:
                extracted_qa = static_db[subject_title][grade_year].get('qa_data', [])
                
            session_id = int(time.time())
            # هنا تم تعديل الـ Prompt لإجبار الذكاء الاصطناعي على تسمية المصفوفة qa_data لكي تطابق الجافاسكريبت تماماً
            prompt = "أنت الآن خبير إعداد امتحانات ومناهج مصرية في منصة Educational platform.\n"
            prompt += f"الجهة التعليمية الملزمة: {education_authority}.\n"
            prompt += f"المسار التعليمي الملزم: {'أزهري' if education_track == 'azhar' else 'تربية وتعليم عام'}.\n"
            prompt += f"المرحلة التعليمية: {stage}. الشعبة أو المسار: {branch}. الصف: {grade_year}.\n"
            prompt += "طبّق صياغة الجهة والمسار المحددين ولا تخلط بين التعليم العام والأزهر. أنشئ أسئلة تدريبية أصلية مستندة إلى الصور والمقرر، ولا تدّعِ أنها أسئلة رسمية أو مضمونة.\n"
            prompt += "في الرياضيات لكل المراحل: لا تكتفِ بالإجابة النهائية؛ اشرح المعطيات والمطلوب والقانون أو الفكرة، خطوات الحل بالتتابع، ثم راجع الناتج ووحداته إن وجدت. اجعل الصعوبة واللغة مناسبين للمرحلة والشعبة.\n"
            prompt += "قواعد المرحلة: ابتدائي 1-3 فهم بسيط وأمثلة محسوسة؛ ابتدائي 4-6 قراءة وأسئلة مباشرة؛ إعدادي عام تحليل وسبب ونتيجة، وإعدادي أزهري قواعد فقهية ونحوية مع تعليل؛ ثانوي عام قرابة 85% اختيار من متعدد و15% مقالي قصير؛ ثانوي أزهري أسئلة مقالية تفصيلية واختيارات مباشرة لاسترجاع النص؛ التعليم الفني جدارات مهنية وخطوات تنفيذ وسلامة.\n"
            prompt += "التصحيح: في العام يُقبل المعنى الصحيح مع الكلمات المفتاحية أو القانون دون نسخ حرفي. في الأزهر لا تُمنح الدرجة الكاملة في السؤال النصي إلا مع الدليل الصحيح إذا طلبه السؤال.\n"
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
                error_msg = friendly_gemini_error(response_data)
                return jsonify({"error": f"حصلت مشكلة مؤقتة في خدمة الذكاء الاصطناعي: {error_msg}"}), 503
                
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
