// @ts-nocheck
// ============================================================================
// ملف الجافاسكريبت الرئيسي (java.js) - منصة الذكاء الاصطناعي
// ============================================================================

const premiumCompactStyle = document.createElement('style');
premiumCompactStyle.innerHTML = `
    body { padding: 10px !important; }
    .container { max-width: 720px !important; padding: 22px !important; border-radius: 16px !important; }
    .action-btn, .download-pdf-btn, .subscribe-btn { padding: 12px !important; font-size: 0.95rem !important; border-radius: 8px !important; }
    .form-group label { font-size: 0.9rem !important; margin-bottom: 6px !important; }
    select, input[type="text"], input[type="password"], input[type="tel"] { padding: 10px 14px !important; font-size: 0.9rem !important; border-radius: 8px !important; }
    .logo-text-box h1 { font-size: 1.5rem !important; }
    .logo-icon-box { width: 45px !important; height: 45px !important; font-size: 1.4rem !important; }
    .interactive-q-card { padding: 15px !important; border-radius: 10px !important; margin-bottom: 15px !important; }
    .interactive-q-title { font-size: 1.05rem !important; margin-bottom: 10px !important; }
    .option-label { padding: 10px 12px !important; font-size: 0.9rem !important; gap: 8px !important; }
    textarea.student-text-answer { font-size: 0.9rem !important; padding: 10px !important; }
    .pdf-question-block { padding: 12px !important; font-size: 0.95rem !important; margin-bottom: 15px !important; }
    #lesson-upload-box { padding: 15px !important; }
    #lesson-upload-box i { font-size: 2rem !important; margin-bottom: 10px !important; }
`;
document.head.appendChild(premiumCompactStyle);

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

function resetSessionTimer() {
    if (isVIPLoggedIn) {
        localStorage.setItem('last_activity_time', Date.now().toString());
    }
}

function checkSessionTimeout() {
    if (isVIPLoggedIn) {
        const lastActivity = localStorage.getItem('last_activity_time');
        if (lastActivity && (Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT_MS)) {
            logout();
            showCustomAlert("تم إنهاء الجلسة التلقائي لحماية حسابك بسبب عدم التفاعل لمدة 5 دقائق. يرجى تسجيل الدخول مجدداً.", 'error');
        }
    }
}

['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetSessionTimer);
});

setInterval(checkSessionTimeout, 60000);

window.addEventListener('load', () => {
    setTimeout(() => {
        const customSplash = document.getElementById('custom-splash-screen');
        if (customSplash) {
            customSplash.style.opacity = '0';
            customSplash.style.visibility = 'hidden';
            setTimeout(() => {
                customSplash.remove();
                if (!isVIPLoggedIn) {
                    showAuthScreen();
                }
            }, 800);
        } else {
            if (!isVIPLoggedIn) {
                showAuthScreen();
            }
        }
    }, 3000); 
});

let appHiddenTime = 0;
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        appHiddenTime = Date.now();
    } else if (document.visibilityState === "visible") {
        if (appHiddenTime > 0 && (Date.now() - appHiddenTime > 45000)) {
            window.location.reload();
        }
    }
});

const localDBHelper = {
    openDB: () => new Promise((resolve, reject) => {
        const request = indexedDB.open('EduPlatformOfflineDB', 1);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('offline_analytics')) {
                database.createObjectStore('offline_analytics', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }),
    saveAnalyticsLocally: async (data) => {
        try {
            const database = await localDBHelper.openDB();
            return new Promise((resolve, reject) => {
                const tx = database.transaction('offline_analytics', 'readwrite');
                tx.objectStore('offline_analytics').add({ payload: data, timestamp: Date.now() });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject();
            });
        } catch(e) { 
            console.error("IndexedDB Save Error:", e); 
        }
    },
    clearAnalyticsLocally: async (id) => {
        try {
            const database = await localDBHelper.openDB();
            return new Promise((resolve) => {
                const tx = database.transaction('offline_analytics', 'readwrite');
                tx.objectStore('offline_analytics').delete(id);
                tx.oncomplete = () => resolve();
            });
        } catch(e) {}
    }
};

window.syncOfflineAnalyticsToFirebase = async function(offlineDataList) {
    if(!offlineDataList || offlineDataList.length === 0) return;
    try {
        for(let record of offlineDataList) {
            await db.collection("exam_analytics").add(record.payload);
            await localDBHelper.clearAnalyticsLocally(record.id);
        }
        showToast("تمت مزامنة بيانات الامتحانات الأوفلاين مع السيرفر بنجاح!", "#10b981");
    } catch (e) {
        console.error("فشل المزامنة مع السيرفر:", e);
    }
};

const firebaseConfig = {
    apiKey: "AIzaSyCQ0JfHCIm6QHM8jUstac90kIdViw-djBk",
    authDomain: "educational-platform-19a75.firebaseapp.com",
    projectId: "educational-platform-19a75",
    storageBucket: "educational-platform-19a75.firebasestorage.app",
    messagingSenderId: "929411249577",
    appId: "1:929411249577:web:e5783818589e4ffd8440b8",
    measurementId: "G-JE5DFXY8F1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const AUTHORIZED_ADMIN_PHONES = ["01026336159"];
const MULTI_DEVICE_PHONES = ["01026336159", "01010482432", "01011974537", "01021059077", "01022750575"];
const VIP_ADMIN_NUMBERS = ["01021059077", "01026336159", "01063028258", "01558884868", "01010482432", "01011974537", "01022750575"];

let currentTeacherId = null;
let isVIPLoggedIn = false; 
let currentUserRole = "User";
let selectedLessonFiles = []; 
let filterSelectedSubject = "";
let filterSelectedStage = "";
let filterSelectedType = "";
let filterSelectedGrade = "";
let globalLessonContext = "لا يوجد درس مرفوع حالياً. أنا مستعد للإجابة على أي أسئلة تعليمية عامة.";
let globalTeacherStyle = "";
let isTeacherRecording = false;
let currentActiveDashTab = "users";

let interactiveExamData = [];
let interactiveExamTimer = null;
let interactiveExamTimeLeft = 0;
let interactiveExamTotalTime = 0;
let examStartTime = 0;

function updateGamification(pointsToAdd) {
    let pts = parseInt(localStorage.getItem('user_points') || '0') + pointsToAdd;
    localStorage.setItem('user_points', pts);
    
    let lastVisit = localStorage.getItem('last_visit_date');
    let today = new Date().toDateString();
    let streak = parseInt(localStorage.getItem('study_streak') || '0');
    
    if (lastVisit !== today) {
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastVisit === yesterday.toDateString()) {
            streak++;
        } else if (!lastVisit) {
            streak = 1;
        } else {
            streak = 1; 
        }
        localStorage.setItem('last_visit_date', today);
        localStorage.setItem('study_streak', streak);
    }
    
    let ptsEl = document.getElementById('ui-user-points');
    let strkEl = document.getElementById('ui-user-streak');
    if(ptsEl) {
        ptsEl.innerText = pts;
    }
    if(strkEl) {
        strkEl.innerText = streak + ' أيام';
    }
}

function showCustomAlert(message, type = 'error') {
    if (document.getElementById('custom-alert-overlay')) {
        document.getElementById('custom-alert-overlay').remove();
    }

    let icon = type === 'error' ? '<i class="fas fa-exclamation-triangle" style="color:#ef4444; font-size: 2.5rem; margin-bottom: 10px;"></i>' : '<i class="fas fa-check-circle" style="color:#10b981; font-size: 2.5rem; margin-bottom: 10px;"></i>';
    let titleColor = type === 'error' ? '#ef4444' : '#10b981';
    let btnColor = type === 'error' ? '#ef4444' : '#10b981';

    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(5px); padding:15px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:350px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:20px 15px; border-top: 4px solid ${titleColor}; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            ${icon}
            <h3 style="margin: 0 0 10px 0; color:#0f172a; font-size:1.2rem;">تنبيه النظام</h3>
            <p style="color:#475569; font-size:0.95rem; line-height:1.6; margin-bottom:20px; font-weight:bold;">${message}</p>
            <button onclick="document.getElementById('custom-alert-overlay').remove()" style="background:${btnColor}; color:white; border:none; padding:10px 25px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:0.3s;">حسناً</button>
        </div>
        <style>
            @keyframes scaleInAlert { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        </style>
    `;
    document.body.appendChild(overlay);
}

function showCustomConfirm(message, callback) {
    if (document.getElementById('custom-confirm-overlay')) {
        document.getElementById('custom-confirm-overlay').remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(5px); padding:15px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:350px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:20px 15px; border-top: 4px solid #f59e0b; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <i class="fas fa-question-circle" style="color:#f59e0b; font-size: 2.5rem; margin-bottom: 10px;"></i>
            <h3 style="margin: 0 0 10px 0; color:#0f172a; font-size:1.2rem;">تأكيد الإجراء</h3>
            <p style="color:#475569; font-size:0.95rem; line-height:1.6; margin-bottom:20px; font-weight:bold;">${message}</p>
            <div style="display:flex; gap:10px;">
                <button id="custom-confirm-yes" style="flex:1; background:#f59e0b; color:white; border:none; padding:10px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 12px rgba(245, 158, 11, 0.2);">نعم، متأكد</button>
                <button id="custom-confirm-no" style="flex:1; background:#f1f5f9; color:#475569; border:none; padding:10px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer;">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('custom-confirm-yes').onclick = () => {
        overlay.remove();
        callback(true);
    };
    document.getElementById('custom-confirm-no').onclick = () => {
        overlay.remove();
        callback(false);
    };
}

function stripParentheses(text) {
    if (!text) return "";
    return text.replace(/\s*\([^)]*\)/g, '').trim();
}

function createAuthScreen() {
    if (document.getElementById('auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.85); z-index:999999; display:none; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; overflow-y:auto; font-family: "Cairo", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; backdrop-filter: blur(8px); padding: 15px; box-sizing: border-box;';
    
    overlay.innerHTML = `
        <div style="width:100%; max-width:380px; background:#ffffff; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border-top: 4px solid #0ea5e9; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:20px 15px; text-align:center; color:white; border-radius: 12px 12px 0 0;">
                <img src="1234.jpg" alt="Logo" style="width: 100px; height: auto; border-radius: 14px; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
                <p style="font-size:0.9rem; color:#cbd5e1; margin:0; font-weight:bold;">منصة الذكاء الاصطناعي التعليمية</p>
            </div>
            
            <div id="auth-user-card" style="padding:20px 20px; text-align:center;">
                <h3 style="color:#1e293b; margin-top:0; margin-bottom:8px; font-size:1.15rem;">تسجيل الدخول للمنصة</h3>
                <p style="color:#64748b; font-size:0.85rem; margin-bottom:15px;" id="auth-instruction-text">أدخل رقم هاتفك للبدء</p>
                
                <input type="tel" id="auth-phone" autocomplete="off" placeholder="رقم الموبايل (مثال: 010xxxxxxxx)" style="width:100%; padding:12px; font-size:1rem; border:2px solid #e2e8f0; border-radius:8px; margin-bottom:10px; box-sizing:border-box; direction:rtl; text-align:center; font-weight:bold;">
                
                <div id="auth-password-container" style="display:none;">
                    <input type="password" id="auth-password" autocomplete="new-password" placeholder="أدخل الرقم السري" style="width:100%; padding:12px; font-size:1rem; border:2px solid #e2e8f0; border-radius:8px; margin-bottom:15px; box-sizing:border-box; direction:rtl; text-align:center; font-weight:bold;">
                </div>
                
                <button id="auth-next-btn" style="width:100%; background:#0ea5e9; color:white; border:none; padding:12px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.3s; box-shadow:0 4px 12px rgba(14,165,233,0.3);">التالي <i class="fas fa-arrow-left"></i></button>
                <button id="auth-login-btn" style="display:none; width:100%; background:#10b981; color:white; border:none; padding:12px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.3s; box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-sign-in-alt"></i> دخول المنصة</button>
                
                <div style="border-bottom:1px solid #e2e8f0; margin:15px 0;"></div>
                <button id="auth-close-btn" style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:10px; font-size:0.85rem; border-radius:8px; font-weight:bold; cursor:pointer;">إغلاق النافذة</button>
            </div>

            <div id="auth-payment-card" style="padding:20px 20px; text-align:center; display:none;">
                <div style="width:45px; height:45px; background:#fef3c7; color:#b45309; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:1.2rem; margin-bottom:10px;"><i class="fas fa-crown"></i></div>
                <h3 style="color:#1e293b; margin-top:0; margin-bottom:8px;">تفعيل عضوية VIP</h3>
                <p style="color:#64748b; font-size:0.85rem; margin-bottom:15px;">انتهت محاولاتك المجانية. للاستمرار يرجى الاشتراك.</p>
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:15px; font-size:0.85rem; line-height:1.6; color:#334155; text-align: right;">
                    <strong>باقات الاشتراك المتاحة:</strong><br>
                    • للطلاب: من 100 إلى 300 جنيه (خصم يصل لـ 25% كل 3 شهور عند دفع الحد الأقصى 300 ج).<br>
                    • للمدرسين: من 200 إلى 600 جنيه (خصم يصل لـ 25% كل شهرين إلى 3 شهور عند دفع الحد الأقصى 600 ج).<br><br>
                    قم بالتحويل لفودافون كاش على الرقم <strong style="color:#0ea5e9; font-size:1rem;" dir="ltr">01026336159</strong><br>
                    وبعد إتمام التحويل، اضغط تأكيد وسنقوم بتوجيهك للواتس آب.
                </div>
                
                <button id="auth-request-btn" style="width:100%; background:#10b981; color:white; border:none; padding:12px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; margin-bottom:10px; box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-paper-plane"></i> تأكيد الدفع</button>
                <button id="auth-back-btn" style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:10px; font-size:0.9rem; border-radius:8px; font-weight:bold; cursor:pointer;">رجوع</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('auth-close-btn').addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    
    document.getElementById('auth-back-btn').addEventListener('click', () => {
        document.getElementById('auth-payment-card').style.display = 'none';
        document.getElementById('auth-user-card').style.display = 'block';
    });

    document.getElementById('auth-next-btn').addEventListener('click', handleAuthNextStep);
    document.getElementById('auth-login-btn').addEventListener('click', handleUserLoginFinal);
    document.getElementById('auth-request-btn').addEventListener('click', handlePaymentRequest);
}

function showAuthScreen() {
    createAuthScreen();
    document.getElementById('auth-phone').value = '';
    document.getElementById('auth-phone').disabled = false;
    document.getElementById('auth-password').value = '';
    
    document.getElementById('auth-password-container').style.display = 'none';
    document.getElementById('auth-next-btn').style.display = 'block';
    document.getElementById('auth-login-btn').style.display = 'none';
    
    document.getElementById('auth-user-card').style.display = 'block';
    document.getElementById('auth-payment-card').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'flex';
}

async function handleAuthNextStep() {
    let phone = document.getElementById('auth-phone').value.trim();
    if (phone.length < 10) {
        return showCustomAlert("برجاء إدخال رقم موبايل صحيح.", 'error');
    }

    let btn = document.getElementById('auth-next-btn');
    let originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
    btn.disabled = true;

    try {
        let isSpecialNumber = VIP_ADMIN_NUMBERS.includes(phone) || AUTHORIZED_ADMIN_PHONES.includes(phone);
        let docSnap = await db.collection("teachers").doc(phone).get();

        if (docSnap.exists) {
            let data = docSnap.data();
            let hasPassword = !!(data.studentPassword || data.adminPassword);

            document.getElementById('auth-password-container').style.display = 'block';
            document.getElementById('auth-next-btn').style.display = 'none';
            document.getElementById('auth-login-btn').style.display = 'block';
            document.getElementById('auth-phone').disabled = true;

            if (hasPassword) {
                document.getElementById('auth-password').placeholder = "أدخل الرقم السري لحسابك";
                document.getElementById('auth-instruction-text').innerText = "تم التعرف على حسابك، يرجى كتابة الرقم السري";
            } else {
                document.getElementById('auth-password').placeholder = "أنشئ رقماً سرياً جديداً لحسابك";
                document.getElementById('auth-instruction-text').innerText = "حسابك لا يحتوي على رقم سري، يرجى إنشاء كلمة سر جديدة";
            }
        } else {
            let deviceFingerprint = localStorage.getItem("device_fingerprint") || ("DEV_" + Math.random().toString(36).substring(2, 15));
            await db.collection("teachers").doc(phone).set({
                name: "Student_" + phone,
                phone: phone,
                status: isSpecialNumber ? "VIP_Active" : "Free",
                role: isSpecialNumber ? "Admin" : "User",
                registeredDeviceFingerprint: deviceFingerprint,
                createdAt: new Date()
            }, { merge: true });

            document.getElementById('auth-password-container').style.display = 'block';
            document.getElementById('auth-next-btn').style.display = 'none';
            document.getElementById('auth-login-btn').style.display = 'block';
            document.getElementById('auth-phone').disabled = true;
            document.getElementById('auth-password').placeholder = "أنشئ رقماً سرياً جديداً لحسابك";
            document.getElementById('auth-instruction-text').innerText = "مرحباً بك! يرجى إنشاء كلمة سر جديدة لحسابك";
        }
    } catch (e) {
        showCustomAlert("خطأ في الاتصال بالشبكة: " + e.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleUserLoginFinal() {
    const phone = document.getElementById('auth-phone').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (password.length < 4) {
        return showCustomAlert("الرقم السري يجب ألا يقل عن 4 خانات.", 'error');
    }
    
    const btn = document.getElementById('auth-login-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> دخول...';
    
    currentTeacherId = phone;
    let deviceFingerprint = localStorage.getItem("device_fingerprint") || ("DEV_" + Math.random().toString(36).substring(2, 15));
    localStorage.setItem("device_fingerprint", deviceFingerprint);

    try {
        const teacherRef = db.collection("teachers").doc(currentTeacherId);
        const doc = await teacherRef.get();
        let teacherData = doc.data() || {};

        let isAuthorizedAdmin = AUTHORIZED_ADMIN_PHONES.includes(phone);
        let assignedRole = isAuthorizedAdmin ? "Admin" : teacherData.role || "User";

        if (isAuthorizedAdmin) {
            if (!teacherData.adminPassword) {
                await teacherRef.set({
                    phone: phone,
                    name: teacherData.name || ("Admin_" + phone),
                    adminPassword: password,
                    status: "VIP_Active",
                    role: "Admin",
                    createdAt: teacherData.createdAt || new Date()
                }, { merge: true });
            } else if (teacherData.adminPassword !== password) {
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                return showCustomAlert("الرقم السري للإدارة غير صحيح!", 'error');
            }
        } else {
            if (!teacherData.studentPassword) {
                await teacherRef.set({
                    phone: phone,
                    name: teacherData.name || ("Student_" + phone),
                    studentPassword: password,
                    status: teacherData.status || "Free",
                    role: teacherData.role || "User",
                    createdAt: teacherData.createdAt || new Date()
                }, { merge: true });
            } else if (teacherData.studentPassword !== password) {
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                return showCustomAlert("الرقم السري غير صحيح!", 'error');
            }

            let isExemptFromDeviceLock = MULTI_DEVICE_PHONES.includes(phone);
            if (teacherData.registeredDeviceFingerprint && teacherData.registeredDeviceFingerprint !== deviceFingerprint && !isExemptFromDeviceLock) {
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                return showCustomAlert("هذا الحساب مرتبط بجهاز آخر لحمايتك.", 'error');
            }
            await teacherRef.set({
                registeredDeviceFingerprint: deviceFingerprint
            }, { merge: true });
        }

        if (teacherData.status === "Pending_Review") {
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
            document.getElementById('auth-user-card').style.display = 'none';
            document.getElementById('auth-payment-card').style.display = 'block';
            return showCustomAlert("حسابك قيد المراجعة.", 'error');
        }

        let isExpired = await checkAndLockIfExpired(phone, teacherData);
        if (isExpired && !isAuthorizedAdmin) {
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
            document.getElementById('auth-user-card').style.display = 'none';
            document.getElementById('auth-payment-card').style.display = 'block';
            return showCustomAlert("انتهت مدة اشتراكك.", 'error');
        }

        loginSuccess(phone, assignedRole);
        
    } catch (e) {
        console.error("LOGIN ERROR:", e);
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
        showCustomAlert("حدث خطأ أثناء تسجيل الدخول:<br><br><strong>" + String(e.message || e) + "</strong>", 'error');
    }
}

function showAdminQuickActionToast(phone) {
    let toastId = 'quick-action-' + phone;
    if (document.getElementById(toastId)) return;

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:#ffffff; border-right:5px solid #f59e0b; padding:16px 20px; border-radius:10px; font-weight:bold; z-index:9999999; box-shadow:0 10px 25px rgba(0,0,0,0.2); text-align:right; font-family: "Cairo", sans-serif; min-width:300px; animation: slideInRight 0.4s ease; display:flex; flex-direction:column; gap:10px;`;
    
    toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#b45309; font-size:1.1rem;"><i class="fas fa-bell"></i> طلب تفعيل جديد!</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
        </div>
        <p style="margin:0; color:#334155; font-size:0.95rem;">الطالب رقم <span dir="ltr" style="color:#0ea5e9;">${phone}</span> قام بتأكيد الدفع وينتظر التفعيل.</p>
        <button onclick="manualActivateVIP('${phone}'); this.parentElement.remove();" style="background:#10b981; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; width:100%;"><i class="fas fa-check"></i> تفعيل VIP فوراً</button>
        <style>@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }</style>
    `;
    document.body.appendChild(toast);
}

function startAdminNotificationListener() {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    
    db.collection("teachers").where("status", "==", "Pending_Review")
      .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
              if (change.type === "added" || change.type === "modified") {
                  let data = change.doc.data();
                  if (data.paymentRequestedAt) {
                      let reqTime = data.paymentRequestedAt.toDate ? data.paymentRequestedAt.toDate().getTime() : data.paymentRequestedAt;
                      if (Date.now() - reqTime < 5 * 60 * 1000) {
                          showAdminQuickActionToast(change.doc.id);
                      }
                  }
              }
          });
      });
}

async function notifyAdminSubscriptionExpired(expiredPhone, durationText) {
    try {
        const adminAlertMsg = `تنبيه من النظام: المشترك رقم (${expiredPhone}) انتهت مدة اشتراكه (${durationText || "المحددة"}) وتم قفل حسابه وإجباره على التجديد.`;
        await db.collection("admin_notifications").add({
            phone: expiredPhone,
            message: adminAlertMsg,
            type: "SUBSCRIPTION_EXPIRED",
            createdAt: new Date(),
            read: false
        });
    } catch (e) {}
}

async function checkAndLockIfExpired(phone, teacherData) {
    if (AUTHORIZED_ADMIN_PHONES.includes(phone) || MULTI_DEVICE_PHONES.includes(phone) || teacherData.role === "Admin") return false; 
    if (teacherData.isLifetimeVIP) return false;

    if (teacherData.status === "VIP_Active" && teacherData.subscriptionEnd) {
        let endDate = teacherData.subscriptionEnd.toDate ? teacherData.subscriptionEnd.toDate().getTime() : new Date(teacherData.subscriptionEnd).getTime();
        
        if (Date.now() > endDate) {
            await db.collection("teachers").doc(phone).update({
                status: "Expired",
                expiredAt: new Date()
            });
            teacherData.status = "Expired";
            
            notifyAdminSubscriptionExpired(phone, teacherData.vipDurationText || "المدة المحددة");
            return true;
        }
    }
    return (teacherData.status === "Expired");
}

function showFreeTrialSelectionModal() {
    const overlay = document.createElement('div');
    overlay.id = 'free-trial-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.9); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(8px); padding:20px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:450px; border-radius:20px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:35px 25px; border-top: 5px solid #8b5cf6; margin: auto; max-height: 95vh; overflow-y: auto;">
            <i class="fas fa-gift" style="color:#8b5cf6; font-size: 3.5rem; margin-bottom: 15px;"></i>
            <h2 style="margin: 0 0 10px 0; color:#0f172a;">هدية ترحيبية للطلاب الجدد!</h2>
            <p style="color:#475569; font-size:1.05rem; line-height:1.6; margin-bottom:25px;">بما أنك زائر جديد، يمكنك اختيار مدة التجربة المجانية لاختبار قوة المنصة. <b>(هذا العرض متاح مرة واحدة فقط ولا يتجدد نهائياً)</b></p>
            
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button onclick="startFreeTrialTimer(1)" style="background:#f1f5f9; color:#334155; border:2px solid #cbd5e1; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; transition:0.3s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='#cbd5e1'">تجربة سريعة (دقيقة واحدة)</button>
                <button onclick="startFreeTrialTimer(3)" style="background:#f1f5f9; color:#334155; border:2px solid #cbd5e1; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; transition:0.3s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='#cbd5e1'">تجربة متوسطة (3 دقائق)</button>
                <button onclick="startFreeTrialTimer(5)" style="background:#8b5cf6; color:#ffffff; border:none; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; box-shadow:0 4px 15px rgba(139,92,246,0.3);">تجربة كاملة (أقصى حد: 5 دقائق)</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    window.startFreeTrialTimer = function(minutes) {
        localStorage.setItem('has_used_free_trial_v2', 'true');
        localStorage.setItem('free_trial_end_time', Date.now() + (minutes * 60 * 1000));
        overlay.remove();
        showToast(`تم تفعيل تجربتك المجانية لمدة ${minutes} دقائق! استمتع بالمنصة.`, "#8b5cf6");
    };
}

function checkFreeTrialAndAccess() {
    if (isVIPLoggedIn && (currentUserRole === 'Admin' || currentUserRole === 'Teacher')) {
        return true;
    }

    let hasUsedTrial = localStorage.getItem('has_used_free_trial_v2');
    let trialEnd = localStorage.getItem('free_trial_end_time');

    if (!hasUsedTrial) {
        showFreeTrialSelectionModal();
        return false;
    }

    if (trialEnd && Date.now() > parseInt(trialEnd)) {
        showCustomAlert("انتهت فترة التجربة المجانية الخاصة بك نهائياً. يجب عليك تفعيل عضويتك أو الدفع لكل مادة للمتابعة.", 'error');
        setTimeout(() => {
            showAuthScreen();
        }, 1500);
        return false;
    }
    return true; 
}

async function handlePaymentRequest() {
    if (!currentTeacherId) return;

    const btn = document.getElementById('auth-request-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';
    btn.style.pointerEvents = "none";

    try {
        const teacherRef = db.collection("teachers").doc(currentTeacherId);
        let isAuthorizedAdmin = AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId);

        await teacherRef.update({
            status: isAuthorizedAdmin ? "VIP_Active" : "Pending_Review",
            paymentRequestedAt: new Date(),
            role: isAuthorizedAdmin ? "Admin" : "User"
        });

        showCustomAlert("تم إرسال طلب التفعيل بنجاح! سيتم توجيهك الآن للواتس آب لإرسال رسالة للإدارة.", 'success');
        
        let adminPhoneForWhatsapp = AUTHORIZED_ADMIN_PHONES[0]; 
        let whatsappMsg = encodeURIComponent(`مرحباً.. لقد قمت بتحويل مبلغ الاشتراك للمنصة.\nبرجاء تفعيل حسابي.\nرقم هاتفي المسجل هو: ${currentTeacherId}`);
        setTimeout(() => {
            window.open(`https://wa.me/2${adminPhoneForWhatsapp}?text=${whatsappMsg}`, '_blank');
        }, 1500);
        
        document.getElementById('auth-overlay').style.display = 'none';
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> تأكيد الدفع وطلب التفعيل';
        btn.style.pointerEvents = "auto";
    } catch (err) {
        showCustomAlert("حدث خطأ أثناء إرسال الطلب: " + err.message, 'error');
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> تأكيد الدفع وطلب التفعيل';
        btn.style.pointerEvents = "auto";
    }
}

function showToast(message, bgColor = "#10b981") {
    let toast = document.getElementById('sys-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sys-toast';
        toast.style.cssText = `position:fixed; top:-100px; left:50%; transform:translateX(-50%); background:${bgColor}; color:white; padding:16px 32px; border-radius:10px; font-weight:bold; font-size:1.1rem; z-index:9999999; box-shadow:0 4px 15px rgba(0,0,0,0.2); transition:top 0.4s ease; text-align:center; font-family: "Cairo", "Segoe UI", sans-serif;`;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.style.background = bgColor;
    setTimeout(() => {
        toast.style.top = '20px';
    }, 100);
    setTimeout(() => {
        toast.style.top = '-100px';
    }, 3500);
}

function loginSuccess(phone, role) {
    isVIPLoggedIn = true;
    currentUserRole = role;
    currentTeacherId = phone;
    
    localStorage.setItem('saved_user_phone', phone);
    localStorage.setItem('saved_user_role', role);
    resetSessionTimer();
    
    let searchBoxElem = document.getElementById('stage-search');
    if (searchBoxElem) {
        searchBoxElem.value = '';
        searchBoxElem.setAttribute('name', 'search-term-' + Date.now()); 
        searchBoxElem.setAttribute('autocomplete', 'new-password'); 
        
        let clearAttempts = 0;
        let clearSearchInterval = setInterval(() => {
            if (searchBoxElem.value === phone || searchBoxElem.value === localStorage.getItem('saved_user_phone')) {
                searchBoxElem.value = '';
            }
            clearAttempts++;
            if (clearAttempts > 10) { 
                clearInterval(clearSearchInterval); 
            }
        }, 300);
    }
    
    updateGamification(0); 

    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
    
    const oldTeacherSec = document.querySelector('.teacher-section');
    if (oldTeacherSec) oldTeacherSec.style.display = 'none';

    showToast("تم تسجيل الدخول بنجاح!");
    buildDynamicUserMenu(phone, role);

    if (role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone)) {
        startAdminNotificationListener();
    }
}

function logout() {
    isVIPLoggedIn = false;
    currentTeacherId = null;
    currentUserRole = "User";
    
    localStorage.removeItem('saved_user_phone');
    localStorage.removeItem('saved_user_role');
    localStorage.removeItem('last_activity_time');
    
    const oldTeacherSec = document.querySelector('.teacher-section');
    if (oldTeacherSec) oldTeacherSec.style.display = 'block';
    
    const menu = document.getElementById('dynamic-user-menu');
    if (menu) menu.remove();

    showToast("تم تسجيل الخروج", "#ef4444");
    showAuthScreen();
}

async function changeAdminPassword() {
    if (!currentTeacherId || (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin')) {
        showCustomAlert("غير مصرح لك بتغيير كلمة السر.", 'error');
        return;
    }

    if (document.getElementById('custom-change-pass-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'custom-change-pass-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(6px); padding:20px; overflow-y:auto;';
    
    modal.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:440px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); border-top: 5px solid #0284c7; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="padding:22px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:38px; height:38px; background:#e0f2fe; color:#0284c7; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem;"><i class="fas fa-key"></i></div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.15rem; font-weight:bold;">تغيير الرقم السري للإدارة</h3>
                </div>
                <button id="change-pass-close-x" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding:22px 20px;">
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.88rem; color:#334155; margin-bottom:6px; font-weight:bold;">الرقم السري الحالي:</label>
                    <input type="password" id="cp-old" placeholder="أدخل الباسورد الحالي..." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; box-sizing:border-box;">
                </div>
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.88rem; color:#334155; margin-bottom:6px; font-weight:bold;">الرقم السري الجديد:</label>
                    <input type="password" id="cp-new" placeholder="أدخل الرقم الجديد (4 خانات على الأقل)..." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; box-sizing:border-box;">
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-size:0.88rem; color:#334155; margin-bottom:6px; font-weight:bold;">تأكيد الرقم السري الجديد:</label>
                    <input type="password" id="cp-confirm" placeholder="أعد إدخال الرقم الجديد..." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; box-sizing:border-box;">
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="cp-submit-btn" style="flex:1; background:#0284c7; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;"><i class="fas fa-save"></i> حفظ</button>
                    <button id="cp-cancel-btn" style="background:#f1f5f9; color:#475569; border:none; padding:12px 18px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;">إلغاء</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('change-pass-close-x').onclick = () => {
        modal.remove();
    };
    document.getElementById('cp-cancel-btn').onclick = () => {
        modal.remove();
    };

    document.getElementById('cp-submit-btn').onclick = async () => {
        const oldPass = document.getElementById('cp-old').value.trim();
        const newPass = document.getElementById('cp-new').value.trim();
        const confirmPass = document.getElementById('cp-confirm').value.trim();

        if (!oldPass || !newPass || !confirmPass) {
            showCustomAlert("برجاء ملء جميع الحقول المطلوبة.", 'error');
            return;
        }

        if (newPass.length < 4) {
            showCustomAlert("يجب ألا يقل الرقم السري الجديد عن 4 أرقام أو أحرف.", 'error');
            return;
        }

        if (newPass !== confirmPass) {
            showCustomAlert("كلمتا السر الجديدتان غير متطابقتين.", 'error');
            return;
        }

        try {
            const teacherRef = db.collection("teachers").doc(currentTeacherId);
            const doc = await teacherRef.get();
            
            if (!doc.exists) {
                showCustomAlert("الحساب غير موجود في قاعدة البيانات.", 'error');
                return;
            }

            let teacherData = doc.data();
            let currentSavedPassword = teacherData.adminPassword || "1234";

            if (oldPass !== currentSavedPassword) {
                showCustomAlert("الرقم السري الحالي غير صحيح!", 'error');
                return;
            }

            await teacherRef.update({
                adminPassword: newPass.trim(),
                passwordLastChangedAt: new Date()
            });

            modal.remove();
            showCustomAlert("تم تحديث الرقم السري للإدارة بنجاح!", 'success');

        } catch (e) {
            showCustomAlert("حدث خطأ أثناء تغيير الرقم السري: " + e.message, 'error');
        }
    };
}

function startTeacherRecordingAction() {
    showCustomAlert("أداة تسجيل أسلوب المعلم قيد التطوير حالياً، وسيتم تفعيلها قريباً جداً في التحديث القادم.", 'success');
}

function buildDynamicUserMenu(phone, role) {
    if (document.getElementById('dynamic-user-menu')) return;
    
    const menu = document.createElement('div');
    menu.id = 'dynamic-user-menu';
    menu.style.cssText = 'background:#f8fafc; padding:20px; border-radius:12px; border:2px solid #0ea5e9; margin-top:20px; margin-bottom:20px; text-align:center; box-shadow: 0 4px 10px rgba(0,0,0,0.05); font-family: "Cairo", "Segoe UI", sans-serif;';
    
    let pts = parseInt(localStorage.getItem('user_points') || '0');
    let streak = parseInt(localStorage.getItem('study_streak') || '0');

    let html = `
        <h3 style="color:#0f172a; margin-top:0;"><i class="fas fa-user-check"></i> الحساب مفعل (VIP)</h3>
        <p style="color:#64748b; font-weight:bold; margin-bottom:15px;">رقم الحساب: <span dir="ltr">${phone}</span></p>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; background:#ffffff; padding:15px; border-radius:12px; border:1px solid #e2e8f0; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
            <div style="text-align:center; flex:1; border-left:1px solid #e2e8f0;">
                <i class="fas fa-fire" style="color:#f59e0b; font-size:1.8rem; margin-bottom:5px;"></i>
                <div style="font-size:0.85rem; color:#64748b; font-weight:bold;">سلسلة المذاكرة</div>
                <div id="ui-user-streak" style="font-weight:900; color:#0f172a; font-size:1.1rem;">${streak} أيام</div>
            </div>
            <div style="text-align:center; flex:1;">
                <i class="fas fa-coins" style="color:#10b981; font-size:1.8rem; margin-bottom:5px;"></i>
                <div style="font-size:0.85rem; color:#64748b; font-weight:bold;">نقاطي الذهبية</div>
                <div id="ui-user-points" style="font-weight:900; color:#0f172a; font-size:1.1rem;">${pts}</div>
            </div>
        </div>
    `;
    
    html += `<button id="btn-dyn-record" class="btn action-btn" style="background:#8b5cf6; margin-bottom:10px; width:100%;"><i class="fas fa-microphone-alt"></i> أداة تسجيل أسلوب المعلم</button>`;
    
    if (role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone)) {
        html += `<button id="btn-dyn-dash" class="btn action-btn" style="background:#0b194f; color:#ffffff; margin-bottom:10px; width:100%;"><i class="fas fa-chart-line"></i> لوحة التحكم والإدارة (Dashboard)</button>`;
        html += `<button id="btn-dyn-change-pass" class="btn action-btn" style="background:#0284c7; color:#ffffff; margin-bottom:10px; width:100%;"><i class="fas fa-key"></i> تغيير الرقم السري للإدارة</button>`;
    }
    
    html += `<button id="btn-dyn-logout" class="btn" style="background:#ef4444; color:white; border:none; padding:14px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>`;
    
    menu.innerHTML = html;
    
    const processBtn = document.getElementById('process-btn');
    if (processBtn && processBtn.parentNode) {
        processBtn.parentNode.insertBefore(menu, processBtn);
    }

    document.getElementById('btn-dyn-logout').addEventListener('click', logout);
    
    const recordBtn = document.getElementById('btn-dyn-record');
    if (recordBtn) {
        recordBtn.addEventListener('click', startTeacherRecordingAction);
    }
    
    if (role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone)) {
        const dashBtn = document.getElementById('btn-dyn-dash');
        if (dashBtn) {
            dashBtn.addEventListener('click', () => {
                if (typeof window.loadAndShowDashboard === 'function') {
                    window.loadAndShowDashboard();
                } else if (typeof loadAndShowDashboard === 'function') {
                    loadAndShowDashboard();
                }
            });
        }

        const changePassBtn = document.getElementById('btn-dyn-change-pass');
        if (changePassBtn) {
            changePassBtn.addEventListener('click', changeAdminPassword);
        }
    }
}

// دوال الداشبورد والإدارة...
window.loadAndShowDashboard = async function() {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') {
        showCustomAlert("غير مصرح لك بالوصول إلى لوحة التحكم.", 'error');
        return;
    }

    let container = document.getElementById("custom-admin-dashboard-container");
    if (container) container.remove();

    const isMobile = window.innerWidth <= 768;

    container = document.createElement('div');
    container.id = "custom-admin-dashboard-container";
    container.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #f8fafc; z-index: 9999999; display: flex;
        direction: rtl; font-family: "Cairo", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    `;

    container.innerHTML = `
        <div id="dash-main-wrapper" style="width: 100%; height: 100%; display: flex; background: #f8fafc; position: relative;">
            
            <div id="dash-sidebar-panel" style="${isMobile ? 'position: fixed; top: 0; right: 0; width: 260px; height: 100%; z-index: 100000; transition: right 0.3s ease; box-shadow: -5px 0 25px rgba(0,0,0,0.5);' : 'width: 260px; background: linear-gradient(180deg, #0b194f 0%, #060e2b 100%); color: #ffffff; display: flex; flex-direction: column; flex-shrink: 0; box-shadow: -4px 0 15px rgba(0,0,0,0.2); position: static;'}">
                
                <div style="padding: 22px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 12px;">
                    <img src="1234.jpg" alt="Logo" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: bold;">لوحة تحكم الإدارة</h3>
                        <span style="font-size: 0.75rem; color: #94a3b8;">إدارة المنصة والاشتراكات</span>
                    </div>
                </div>

                <div style="padding: 15px 10px; overflow-y: auto; flex: 1;">
                    <div style="font-size: 0.75rem; color: #64748b; padding: 5px 15px; font-weight: bold;">القائمة الرئيسية</div>
                    <a href="javascript:void(0)" onclick="switchDashTab('users')" id="nav-users" class="dash-nav-item active" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #ffffff; text-decoration: none; border-radius: 8px; background: rgba(14, 165, 233, 0.25); border-right: 4px solid #0ea5e9; margin-bottom: 5px; font-weight: bold;"><i class="fas fa-users"></i> إدارة الحسابات والتفعيل</a>
                    
                    <div style="font-size: 0.75rem; color: #64748b; padding: 15px 15px 5px; font-weight: bold;">المالية والطلبات</div>
                    <a href="javascript:void(0)" onclick="switchDashTab('orders')" id="nav-orders" class="dash-nav-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 5px;"><i class="fas fa-shopping-cart"></i> الطلبات وإيصالات الدفع</a>
                    <a href="javascript:void(0)" onclick="switchDashTab('reports')" id="nav-reports" class="dash-nav-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 5px;"><i class="fas fa-wallet"></i> التقارير المالية</a>

                    <div style="font-size: 0.75rem; color: #64748b; padding: 15px 15px 5px; font-weight: bold;">التحليلات الأكاديمية</div>
                    <a href="javascript:void(0)" onclick="switchDashTab('analytics')" id="nav-analytics" class="dash-nav-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 5px;"><i class="fas fa-chart-pie"></i> أداء الطلاب (Charts)</a>
                </div>

                <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button id="dash-close-full-btn" style="width: 100%; background: #ef4444; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-times"></i> إغلاق لوحة التحكم</button>
                </div>
            </div>

            <div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: #f8fafc; width: 100%;">
                <div style="background: #ffffff; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button id="dash-sidebar-toggle-btn" style="${isMobile ? 'display: inline-flex;' : 'display: none;'} align-items: center; gap: 6px; background: #0b194f; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: bold; cursor: pointer;"><i class="fas fa-bars"></i> القائمة</button>
                        <div>
                            <h2 id="dash-header-title" style="margin: 0; color: #0f172a; font-size: 1.3rem; font-weight: bold;">إدارة الحسابات وطلبات تفعيل VIP</h2>
                            <span id="dash-header-subtitle" style="color: #64748b; font-size: 0.8rem;">مراجعة طلبات التفعيل، أمان الأجهزة، وإضافة أرقام مجانية</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button id="dash-refresh-btn" style="background: #e0f2fe; color: #0369a1; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;"><i class="fas fa-sync-alt"></i> تحديث</button>
                        <button id="dash-close-header-btn" style="background: #fee2e2; color: #991b1b; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer;"><i class="fas fa-times"></i> إغلاق</button>
                    </div>
                </div>

                <div id="dash-tab-content" style="padding: 20px; flex: 1;">
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    container.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('dash-sidebar-panel');
            const toggleBtn = document.getElementById('dash-sidebar-toggle-btn');
            if (sidebar && !sidebar.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
                sidebar.style.right = '-320px';
            }
        }
    });

    const toggleBtn = document.getElementById('dash-sidebar-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sidebar = document.getElementById('dash-sidebar-panel');
            if (sidebar) {
                sidebar.style.right = (sidebar.style.right === '0px' || !sidebar.style.right) ? '-320px' : '0px';
            }
        });
    }

    document.getElementById('dash-close-full-btn').addEventListener('click', () => {
        container.remove();
    });
    document.getElementById('dash-close-header-btn').addEventListener('click', () => {
        container.remove();
    });

    document.getElementById('dash-refresh-btn').addEventListener('click', () => {
        showToast("جاري تحديث البيانات...", "#0ea5e9");
        window.renderActiveDashTab();
    });

    currentActiveDashTab = "users";
    window.renderActiveDashTab();
};

window.switchDashTab = function(tabName) {
    currentActiveDashTab = tabName;
    document.querySelectorAll('.dash-nav-item').forEach(item => {
        item.style.background = "transparent";
        item.style.borderRight = "none";
        item.style.color = "#cbd5e1";
    });

    const activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) {
        activeNav.style.background = "rgba(14, 165, 233, 0.25)";
        activeNav.style.borderRight = "4px solid #0ea5e9";
        activeNav.style.color = "#ffffff";
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('dash-sidebar-panel');
        if (sidebar) sidebar.style.right = '-320px';
    }

    window.renderActiveDashTab();
};

window.loadDashboardTableData = async function() {
    const tableBody = document.getElementById('dash-table-body');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('dash-search-input')?.value || "").trim().toLowerCase();
    const filterStatus = document.getElementById('dash-filter-status')?.value || "ALL";

    try {
        const snapshot = await db.collection("teachers").get();
        let rowsHtml = "";
        let count = 0;
        let totalUsers = 0;
        let pendingUsers = 0;
        let activeUsers = 0;

        snapshot.forEach(doc => {
            totalUsers++;
            let data = doc.data();
            let phone = doc.id;
            let status = data.status || "Free";

            if (status === "VIP_Active" && data.subscriptionEnd && !data.isLifetimeVIP) {
                let endDate = data.subscriptionEnd.toDate ? data.subscriptionEnd.toDate().getTime() : new Date(data.subscriptionEnd).getTime();
                if (Date.now() > endDate && !AUTHORIZED_ADMIN_PHONES.includes(phone) && !MULTI_DEVICE_PHONES.includes(phone)) {
                    status = "Expired";
                }
            }

            if (status === "Pending_Review") pendingUsers++;
            if (status === "VIP_Active") activeUsers++;

            if (searchTerm && !phone.includes(searchTerm) && !(data.name || "").toLowerCase().includes(searchTerm)) return;
            if (filterStatus !== "ALL" && status !== filterStatus) return;

            count++;
            
            let statusBadge = "";
            if (AUTHORIZED_ADMIN_PHONES.includes(phone) || data.isLifetimeVIP || (data.vipDurationText && data.vipDurationText.includes("ما لا نهاية"))) {
                statusBadge = `<span style="background: #ecfdf5; color: #047857; border: 1px solid #059669; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-crown"></i> نشط VIP - ما لا نهاية</span>`;
            } else if (status === "VIP_Active") {
                statusBadge = `<span style="background: #d1fae5; color: #065f46; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">نشط VIP</span>`;
            } else if (status === "Pending_Review") {
                statusBadge = `<span style="background: #fef3c7; color: #b45309; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-clock"></i> معلق للمراجعة</span>`;
            } else if (status === "Expired") {
                statusBadge = `<span style="background: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-exclamation-triangle"></i> منتهي (مغلق)</span>`;
            } else {
                statusBadge = `<span style="background: #f1f5f9; color: #475569; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">مجاني</span>`;
            }

            let deviceBadge = data.registeredDeviceFingerprint 
                ? `<span style="color: #059669; font-weight:bold; font-size:0.85rem;"><i class="fas fa-lock"></i> مرتبط بجهاز</span>`
                : `<span style="color: #94a3b8; font-size:0.85rem;">غير مرتبط</span>`;

            let currentDurationText = data.vipDurationText || "0 يوم";

            let isAdminRole = data.role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone);
            let toggleAdminBtn = `<button onclick="window.toggleAdminAccess('${phone}', ${isAdminRole})" style="background: ${isAdminRole ? '#ef4444' : '#3b82f6'}; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: 4px;" title="تفعيل/إلغاء لوحة التحكم"><i class="fas ${isAdminRole ? 'fa-user-times' : 'fa-user-shield'}"></i> ${isAdminRole ? 'إلغاء الإدارة' : 'ترقية لإدارة'}</button>`;

            rowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                    <td style="padding: 16px 18px; color: #64748b;">${count}</td>
                    <td style="padding: 16px 18px; font-family: monospace; font-size: 1.05rem; font-weight: bold; color: #0f172a;" dir="ltr">${phone}</td>
                    <td style="padding: 16px 18px;">${statusBadge}</td>
                    <td style="padding: 16px 18px;">
                        <input type="text" id="duration_${phone}" value="${currentDurationText}" placeholder="مثال: 365 يوم، ما لا نهاية..." style="width: 170px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;">
                    </td>
                    <td style="padding: 16px 18px;">${deviceBadge}</td>
                    <td style="padding: 16px 18px; white-space: nowrap;">
                        <button onclick="window.manualActivateVIP('${phone}')" style="background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; margin-left: 4px;"><i class="fas fa-check"></i> تفعيل</button>
                        <button onclick="window.resetUserDevice('${phone}')" style="background: #f59e0b; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: 4px;" title="فك ارتباط الجهاز ليتمكن من الدخول بجهاز جديد"><i class="fas fa-mobile-alt"></i> فك الجهاز</button>
                        <button onclick="window.deactivateUserVIP('${phone}')" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: 4px;">إلغاء</button>
                        <button onclick="window.deleteUserAccount('${phone}')" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; margin-left: 4px;" title="حذف الحساب نهائياً"><i class="fas fa-trash"></i></button>
                        ${toggleAdminBtn}
                    </td>
                </tr>
            `;
        });

        if (document.getElementById('stat-total-users')) document.getElementById('stat-total-users').innerText = totalUsers;
        if (document.getElementById('stat-pending-users')) document.getElementById('stat-pending-users').innerText = pendingUsers;
        if (document.getElementById('stat-active-users')) document.getElementById('stat-active-users').innerText = activeUsers;

        if (count === 0) {
            rowsHtml = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: #64748b;">لا توجد حسابات مطابقة للفلاتر الحالية.</td></tr>`;
        }

        tableBody.innerHTML = rowsHtml;
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: red;">حدث خطأ أثناء جلب البيانات: ${e.message}</td></tr>`;
    }
};

window.loadOrdersTableData = async function() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    try {
        const snapshot = await db.collection("teachers").where("status", "==", "Pending_Review").get();
        let rowsHtml = "";
        let count = 0;

        snapshot.forEach(doc => {
            count++;
            let data = doc.data();
            let phone = doc.id;
            
            let receiptHtml = `<span style="color: #b45309; font-weight: bold;"><i class="fas fa-mobile-alt"></i> راجع رسائل فودافون كاش</span>`;
            
            let uploadDate = data.paymentRequestedAt 
                ? new Date(data.paymentRequestedAt.seconds * 1000 || data.paymentRequestedAt).toLocaleDateString('ar-EG')
                : "---";

            rowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 18px;">${count}</td>
                    <td style="padding: 14px 18px; font-weight: bold; font-family: monospace;" dir="ltr">${phone}</td>
                    <td style="padding: 14px 18px;">${receiptHtml}</td>
                    <td style="padding: 14px 18px; color:#64748b;">${uploadDate}</td>
                    <td style="padding: 14px 18px;">
                        <button onclick="window.manualActivateVIP('${phone}')" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">تفعيل VIP الفوري</button>
                    </td>
                </tr>
            `;
        });

        if (count === 0) {
            rowsHtml = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">لا توجد أي طلبات دفع معلقة في الوقت الحالي.</td></tr>`;
        }
        tableBody.innerHTML = rowsHtml;
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="5" style="padding: 30px; text-align: center; color: red;">خطأ في جلب الطلبات: ${e.message}</td></tr>`;
    }
};

window.loadFinancialReportData = async function() {
    const tableBody = document.getElementById('reports-table-body');
    if (!tableBody) return;

    try {
        const snapshot = await db.collection("teachers").where("status", "==", "VIP_Active").get();
        let rowsHtml = "";
        let count = 0;
        let totalIncome = 0;

        snapshot.forEach(doc => {
            let phone = doc.id;
            let data = doc.data();
            
            let durationText = data.vipDurationText || "0 يوم";
            let amountCalculated = 50; 

            if (durationText.includes("مجاني") || 
                durationText.includes("ما لا نهاية") || 
                data.addedManuallyByAdmin || 
                data.isLifetimeVIP ||
                AUTHORIZED_ADMIN_PHONES.includes(phone) ||
                MULTI_DEVICE_PHONES.includes(phone)) {
                amountCalculated = 0;
            } else if (durationText.includes("365") || durationText.includes("سنة") || durationText.includes("عام")) {
                amountCalculated = 500;
            } else if (durationText.includes("6") || durationText.includes("ست")) {
                amountCalculated = 250;
            }

            totalIncome += amountCalculated;
            count++;

            let subDate = data.subscriptionStart 
                ? new Date(data.subscriptionStart.seconds * 1000 || data.subscriptionStart).toLocaleDateString('ar-EG') 
                : "---";

            rowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 15px;">${count}</td>
                    <td style="padding: 12px 15px; font-family: monospace; font-weight: bold;" dir="ltr">${phone}</td>
                    <td style="padding: 12px 15px;">${durationText}</td>
                    <td style="padding: 12px 15px; font-weight: bold; color: #047857;">${amountCalculated} ج.م</td>
                    <td style="padding: 12px 15px; color: #64748b;">${subDate}</td>
                </tr>
            `;
        });

        if (document.getElementById('report-total-revenue')) document.getElementById('report-total-revenue').innerText = totalIncome + " ج.م";
        if (document.getElementById('report-active-subscribers')) document.getElementById('report-active-subscribers').innerText = count;

        if (count === 0) {
            rowsHtml = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">لا توجد حسابات VIP نشطة حتى الآن.</td></tr>`;
        }
        tableBody.innerHTML = rowsHtml;
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="5" style="padding: 30px; text-align: center; color: red;">خطأ في إعداد التقرير المالي: ${e.message}</td></tr>`;
    }
};

window.loadDeepAnalyticsData = async function() {
    try {
        const snapshot = await db.collection("exam_analytics").orderBy("timestamp", "desc").limit(50).get();
        let tableHtml = "";
        
        let gradeScores = {}; 
        let passed = 0; let failed = 0;

        snapshot.forEach(doc => {
            let data = doc.data();
            let phone = data.studentId || "غير معروف";
            let subject = data.subject || "غير محدد";
            let score = data.score || 0;
            let total = data.totalQuestions || 1;
            let timeUsed = data.timeUsedSec || 0;
            
            let percentage = Math.round((score / total) * 100);
            
            if (percentage >= 50) passed++; else failed++;
            
            if (!gradeScores[subject]) gradeScores[subject] = [];
            gradeScores[subject].push(percentage);

            let timeStr = `${Math.floor(timeUsed / 60)} دقيقة و ${timeUsed % 60} ثانية`;
            let color = percentage >= 85 ? "#10b981" : (percentage >= 50 ? "#f59e0b" : "#ef4444");

            tableHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:bold;" dir="ltr">${phone}</td>
                    <td style="padding:12px;">${subject}</td>
                    <td style="padding:12px; font-weight:bold; color:${color};">${score} / ${total} (${percentage}%)</td>
                    <td style="padding:12px; color:#64748b;">${timeStr}</td>
                </tr>
            `;
        });

        if (snapshot.empty) {
            tableHtml = `<tr><td colspan="4" style="text-align:center; padding:20px;">لا توجد بيانات امتحانات مسجلة بعد.</td></tr>`;
        }
        
        document.getElementById('analytics-table-body').innerHTML = tableHtml;

        if (!snapshot.empty && typeof Chart !== 'undefined') {
            let labels = Object.keys(gradeScores);
            let averages = labels.map(subj => {
                let sum = gradeScores[subj].reduce((a, b) => a + b, 0);
                return Math.round(sum / gradeScores[subj].length);
            });

            new Chart(document.getElementById('scoresChart'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'متوسط درجات الطلاب (%)',
                        data: averages,
                        backgroundColor: '#0ea5e9',
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            new Chart(document.getElementById('completionChart'), {
                type: 'doughnut',
                data: {
                    labels: ['ناجح (فوق 50%)', 'راسب (أقل من 50%)'],
                    datasets: [{
                        data: [passed, failed],
                        backgroundColor: ['#10b981', '#ef4444']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        
    } catch (e) {
        document.getElementById('analytics-table-body').innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">خطأ: ${e.message}</td></tr>`;
    }
};

window.printOrdersReportPDF = function() {
    const elementToPrint = document.getElementById('orders-report-print-area');
    if (!elementToPrint) return;

    showToast("جاري تجهيز تقرير الطلبات PDF...");
    const opt = {
        margin: 0.5,
        filename: 'Pending_Orders_' + Date.now() + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(elementToPrint).save();
};

window.printFinancialReportPDF = function() {
    const elementToPrint = document.getElementById('financial-report-print-area');
    if (!elementToPrint) return;

    showToast("جاري تجهيز التقرير المالي الشامل PDF...");
    const opt = {
        margin: 0.5,
        filename: 'Financial_Report_' + Date.now() + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(elementToPrint).save();
};

window.manualActivateVIP = async function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    
    let durationInput = document.getElementById(`duration_${phone}`);
    let customDurationText = durationInput ? durationInput.value.trim() : "0 يوم";
    if (!customDurationText) customDurationText = "0 يوم";

    let daysToAdd = 365;
    let isLifetime = false;
    if (customDurationText.includes("ما لا نهاية") || customDurationText.includes("دائم")) {
        daysToAdd = 36500;
        isLifetime = true;
    } else if (customDurationText.includes("365") || customDurationText.includes("سنة") || customDurationText.includes("عام")) {
        daysToAdd = 365;
    } else if (customDurationText.includes("6") || customDurationText.includes("ست")) {
        daysToAdd = 180;
    } else if (customDurationText.includes("3") || customDurationText.includes("تلات")) {
        daysToAdd = 90;
    } else if (customDurationText.includes("شهر") || customDurationText.includes("30")) {
        daysToAdd = 30;
    } else if (customDurationText.includes("0") || customDurationText.includes("صفر")) {
        daysToAdd = 0;
    }

    let endTimestamp = new Date(Date.now() + (daysToAdd * 24 * 60 * 60 * 1000));

    try {
        await db.collection("teachers").doc(phone).update({
            status: "VIP_Active",
            vipDurationText: customDurationText,
            subscriptionStart: new Date(),
            subscriptionEnd: endTimestamp,
            isLifetimeVIP: isLifetime,
            lastUpdatedByAdmin: new Date()
        });
        showToast(`تم تفعيل حساب ${phone} بنجاح لمدة (${customDurationText})`);
        window.renderActiveDashTab();
    } catch (e) {
        showCustomAlert("خطأ أثناء التفعيل اليدوي: " + e.message, 'error');
    }
};

window.resetUserDevice = function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    showCustomConfirm(`هل تريد فعلاً فك ارتباط جهاز الطالب (${phone}) ليتمكن من الدخول بهاتف جديد؟`, async (isYes) => {
        if(!isYes) return;
        try {
            await db.collection("teachers").doc(phone).update({
                registeredDeviceFingerprint: null
            });
            showToast(`تم فك ارتباط الجهاز للحساب (${phone}) بنجاح!`, "#f59e0b");
            window.renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ: " + e.message, 'error');
        }
    });
};

window.deactivateUserVIP = function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    showCustomConfirm(`هل أنت متأكد من قفل وإلغاء تفعيل حساب الطالب (${phone})؟`, async (isYes) => {
        if(!isYes) return;
        try {
            await db.collection("teachers").doc(phone).update({
                status: "Expired",
                isLifetimeVIP: false,
                lastUpdatedByAdmin: new Date()
            });
            showToast(`تم قفل وإلغاء تفعيل الحساب: ${phone}`, "#ef4444");
            window.renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ: " + e.message, 'error');
        }
    });
};

window.deleteUserAccount = function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    showCustomConfirm(`هل أنت متأكد من حذف الحساب رقم (${phone}) نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذه الخطوة.`, async (isYes) => {
        if(!isYes) return;
        try {
            await db.collection("teachers").doc(phone).delete();
            showToast(`تم حذف الحساب (${phone}) نهائياً بنجاح!`, "#ef4444");
            window.renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ أثناء الحذف: " + e.message, 'error');
        }
    });
};

window.toggleAdminAccess = function(phone, isCurrentlyAdmin) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    
    let newRole = isCurrentlyAdmin ? 'User' : 'Admin';
    let confirmMsg = isCurrentlyAdmin ? `هل أنت متأكد من سحب صلاحيات لوحة التحكم من الرقم (${phone}) وإرجاعه كطالب عادي؟` : `هل أنت متأكد من منح صلاحيات الإدارة للرقم (${phone})؟ (سيتم تعيين الباسورد الافتراضي 1234)`;
    
    showCustomConfirm(confirmMsg, async (isYes) => {
        if(!isYes) return;
        try {
            let updates = { role: newRole };
            if (newRole === 'Admin') {
                updates.adminPassword = '1234'; 
                updates.status = 'VIP_Active';
            }
            await db.collection("teachers").doc(phone).update(updates);
            showToast(`تم تعديل صلاحيات الرقم (${phone}) إلى ${newRole === 'Admin' ? 'مدير' : 'طالب'} بنجاح!`, "#10b981");
            window.renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ: " + e.message, 'error');
        }
    });
};

window.checkAttempts = function() {
    let attempts = parseInt(localStorage.getItem('user_attempts') || 0);
    if (attempts >= 3) {
        showCustomAlert("انتهت محاولاتك المجانية. يرجى الاشتراك في الـ VIP للمتابعة.", 'error');
        showAuthScreen();
        
        document.getElementById('auth-user-card').style.display = 'none';
        document.getElementById('auth-payment-card').style.display = 'block';
        return false;
    }
    return true;
};

window.incrementAttempt = function() {
    let attempts = parseInt(localStorage.getItem('user_attempts') || 0) + 1;
    localStorage.setItem('user_attempts', attempts);
};

// ==========================================
// تفعيل القوائم المنسدلة يدوياً والبحث (كما في الصور الأصلية)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    const mainStage = document.getElementById('main-stage');
    const subStage = document.getElementById('sub-stage');
    const subStageContainer = document.getElementById('sub-stage-container');
    const yearStage = document.getElementById('year-stage');
    const yearStageContainer = document.getElementById('year-stage-container');
    const subjectSelect = document.getElementById('subject-select');
    const subjectContainer = document.getElementById('subject-container');
    const uploadSection = document.getElementById('student-upload-section');
    const extractSection = document.getElementById('extraction-settings');
    const pathDisplay = document.getElementById('selected-path-display');
    const searchInput = document.getElementById('stage-search');
    const searchResults = document.getElementById('search-results');

    // قاعدة بيانات المراحل والشعب والصفوف
    const stagesData = {
        primary: {
            subStages: [],
            years: ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس"],
            subjects: ["اللغة العربية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "اللغة الإنجليزية", "تكنولوجيا المعلومات والاتصالات (ICT)", "التربية الدينية"]
        },
        prep: {
            subStages: [],
            years: ["الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي"],
            subjects: ["اللغة العربية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "اللغة الإنجليزية", "الحاسب الآلي", "التربية الدينية"]
        },
        high_general: {
            subStages: ["علمي علوم", "علمي رياضة", "أدبي"],
            years: ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"],
            subjects: ["اللغة العربية", "اللغة الإنجليزية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", "الفيزياء", "الكيمياء", "الأحياء", "الرياضيات", "التاريخ", "الجغرافيا", "الفلسفة والمنطق", "علم النفس والاجتماع", "الجيولوجيا وعلوم البيئة"]
        },
        high_azhar: {
            subStages: ["علمي", "أدبي"],
            years: ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"],
            subjects: ["القرآن الكريم", "الفقه", "التفسير", "الحديث", "التوحيد", "النحو", "الصرف", "البلاغة", "الأدب والنصوص", "الفيزياء", "الكيمياء", "الأحياء", "الرياضيات", "التاريخ", "الجغرافيا", "اللغة الإنجليزية", "اللغة الفرنسية"]
        },
        diploma: {
            subStages: ["صناعي", "تجاري", "زراعي", "فندقي"],
            years: ["الصف الأول", "الصف الثاني", "الصف الثالث"],
            subjects: ["مبادئ المحاسبة (المالية/الشركات)", "تخطيط وإدارة إنتاج", "اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "الفيزياء"]
        }
    };

    const allUniqueSubjects = [
        "اللغة العربية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "اللغة الإنجليزية", 
        "تكنولوجيا المعلومات والاتصالات (ICT)", "التربية الدينية", "الحاسب الآلي",
        "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", "الفيزياء", "الكيمياء", 
        "الأحياء", "التاريخ", "الجغرافيا", "الفلسفة والمنطق", "علم النفس والاجتماع", 
        "الجيولوجيا وعلوم البيئة", "القرآن الكريم", "الفقه", "التفسير", "الحديث", "التوحيد", 
        "النحو", "الصرف", "البلاغة", "الأدب والنصوص", "مبادئ المحاسبة (المالية/الشركات)", 
        "تخطيط وإدارة إنتاج"
    ];

    function checkAndShowUpload() {
        if (subjectSelect && subjectSelect.value && subjectSelect.value !== "none" && subjectSelect.value !== "") {
            if (uploadSection) uploadSection.classList.remove('hidden-section');
            if (extractSection) extractSection.classList.remove('hidden-section');
            
            if (pathDisplay) {
                pathDisplay.style.display = 'block';
                let pathText = "";
                
                if (mainStage && mainStage.value !== 'none' && mainStage.options[mainStage.selectedIndex]) {
                    pathText += mainStage.options[mainStage.selectedIndex].text;
                } else {
                    pathText += "بحث سريع";
                }

                if (subStageContainer && !subStageContainer.classList.contains('hidden-section') && subStage && subStage.value) {
                    pathText += ' > ' + subStage.value;
                }
                
                if (yearStageContainer && !yearStageContainer.classList.contains('hidden-section') && yearStage && yearStage.value) {
                    pathText += ' > ' + yearStage.value;
                }
                
                pathText += ' > ' + subjectSelect.value;
                pathDisplay.innerHTML = `<i class="fas fa-map-marker-alt"></i> مسار المادة المحدد:<br><strong>${pathText}</strong>`;
            }
        }
    }

    if (mainStage) {
        mainStage.addEventListener('change', () => {
            const val = mainStage.value;
            if (subStage) subStage.innerHTML = '<option value="">-- اختر الشعبة / التخصص --</option>';
            if (yearStage) yearStage.innerHTML = '<option value="">-- اختر الصف الدراسي --</option>';
            if (subjectSelect) subjectSelect.innerHTML = '<option value="">-- اختر المادة --</option>';
            
            if (val === 'none') {
                if (subStageContainer) subStageContainer.classList.add('hidden-section');
                if (yearStageContainer) yearStageContainer.classList.add('hidden-section');
                if (subjectContainer) subjectContainer.classList.add('hidden-section');
                if (uploadSection) uploadSection.classList.add('hidden-section');
                if (extractSection) extractSection.classList.add('hidden-section');
                if (pathDisplay) pathDisplay.style.display = 'none';
                return;
            }

            const data = stagesData[val];
            if (data.subStages.length > 0) {
                data.subStages.forEach(sub => {
                    if (subStage) subStage.innerHTML += `<option value="${sub}">${sub}</option>`;
                });
                if (subStageContainer) subStageContainer.classList.remove('hidden-section');
                if (yearStageContainer) yearStageContainer.classList.add('hidden-section');
            } else {
                if (subStageContainer) subStageContainer.classList.add('hidden-section');
                data.years.forEach(y => {
                    if (yearStage) yearStage.innerHTML += `<option value="${y}">${y}</option>`;
                });
                if (yearStageContainer) yearStageContainer.classList.remove('hidden-section');
            }
            if (subjectContainer) subjectContainer.classList.add('hidden-section');
            if (uploadSection) uploadSection.classList.add('hidden-section');
            if (extractSection) extractSection.classList.add('hidden-section');
            if (pathDisplay) pathDisplay.style.display = 'none';
        });
    }

    if (subStage) {
        subStage.addEventListener('change', () => {
            if (!subStage.value) return;
            const val = mainStage.value;
            if (yearStage) {
                yearStage.innerHTML = '<option value="">-- اختر الصف الدراسي --</option>';
                stagesData[val].years.forEach(y => {
                    yearStage.innerHTML += `<option value="${y}">${y}</option>`;
                });
            }
            if (yearStageContainer) yearStageContainer.classList.remove('hidden-section');
            if (subjectContainer) subjectContainer.classList.add('hidden-section');
        });
    }

    if (yearStage) {
        yearStage.addEventListener('change', () => {
            if (!yearStage.value) return;
            const val = mainStage.value;
            
            if (!val || val === 'none') {
                if (window.searchedSubjectTemp && subjectSelect) {
                    subjectSelect.innerHTML = `<option value="${window.searchedSubjectTemp}" selected>${window.searchedSubjectTemp}</option>`;
                    if (subjectContainer) subjectContainer.classList.remove('hidden-section');
                    checkAndShowUpload();
                }
                return;
            }

            if (subjectSelect) {
                subjectSelect.innerHTML = '<option value="">-- اختر المادة --</option>';
                stagesData[val].subjects.forEach(s => {
                    subjectSelect.innerHTML += `<option value="${s}">${s}</option>`;
                });
                
                if (window.searchedSubjectTemp) {
                    Array.from(subjectSelect.options).forEach(opt => {
                        if (opt.value === window.searchedSubjectTemp) {
                            opt.selected = true;
                        }
                    });
                }
            }
            if (subjectContainer) subjectContainer.classList.remove('hidden-section');
            checkAndShowUpload();
        });
    }

    if (subjectSelect) {
        subjectSelect.addEventListener('change', checkAndShowUpload);
    }

    if (searchInput && searchResults) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim().toLowerCase();
            searchResults.innerHTML = '';
            
            if (!query) {
                searchResults.style.display = 'none';
                return;
            }

            try {
                const res = await fetch('database.json');
                const dbData = await res.json();
                let matchedSubjects = [];

                for (let key in dbData) {
                    if (key.toLowerCase().includes(query)) {
                        matchedSubjects.push(key);
                    }
                }

                allUniqueSubjects.forEach(s => {
                    if (s.toLowerCase().includes(query) && !matchedSubjects.includes(s)) {
                        matchedSubjects.push(s);
                    }
                });

                if (matchedSubjects.length > 0) {
                    searchResults.style.display = 'block';
                    matchedSubjects.forEach(sub => {
                        let li = document.createElement('li');
                        li.textContent = sub;
                        li.style.cssText = "padding: 12px 18px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #334155; transition: 0.2s; font-weight:bold;";
                        li.onmouseover = () => { li.style.backgroundColor = '#e0f2fe'; li.style.color = '#0284c7'; };
                        li.onmouseout = () => { li.style.backgroundColor = 'transparent'; li.style.color = '#334155'; };
                        
                        li.onclick = () => {
                            searchInput.value = sub;
                            searchResults.style.display = 'none';
                            
                            window.searchedSubjectTemp = sub; 
                            
                            const stagesGrid = document.querySelector('.stages-grid');
                            if(stagesGrid) stagesGrid.style.display = 'block';

                            if (mainStage) {
                                mainStage.style.borderColor = '#0ea5e9';
                                mainStage.style.boxShadow = '0 0 0 4px rgba(14, 165, 233, 0.2)';
                                setTimeout(() => {
                                    mainStage.style.borderColor = '';
                                    mainStage.style.boxShadow = '';
                                }, 2500);
                            }

                            showToast("الرجاء اختيار (المرحلة التعليمية) ثم (الصف) من القوائم بالأسفل لإظهار زر الرفع.", "#0ea5e9");
                        };
                        searchResults.appendChild(li);
                    });
                } else {
                    searchResults.style.display = 'none';
                }
            } catch (err) {
                console.error("Search fetch error:", err);
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }

    // ربط رفع الصور
    const lessonUploadBox = document.getElementById('lesson-upload-box');
    const lessonImageInput = document.getElementById('lesson-image');
    const lessonUploadText = document.getElementById('lesson-upload-text');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');

    if (lessonUploadBox && lessonImageInput) {
        lessonUploadBox.addEventListener('click', () => {
            lessonImageInput.click();
        });

        lessonImageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                if (files.length > 10) {
                    showCustomAlert("عفواً، أقصى عدد مسموح به هو 10 صور فقط للمرة الواحدة!", "error");
                    lessonImageInput.value = "";
                    selectedLessonFiles = [];
                    return;
                }
                selectedLessonFiles = files;
                if (lessonUploadText) {
                    lessonUploadText.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> تم إرفاق ${files.length} صور بنجاح`;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (imagePreview) {
                        imagePreview.src = event.target.result;
                        if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden-section');
                    }
                };
                reader.readAsDataURL(files[0]);
                showToast(`تم إرفاق ${files.length} صور بنجاح!`, "#10b981");
            }
        });
    }

    const loginToggle = document.getElementById('teacher-mode');
    if (loginToggle) {
        loginToggle.addEventListener('change', function() {
            if (this.checked) {
                showAuthScreen();
                this.checked = false; 
            }
        });
    }

    const processBtn = document.getElementById('process-btn');
    
    if (processBtn) {
        processBtn.addEventListener('click', async () => {
            
            if (!isVIPLoggedIn) {
                if (!window.checkAttempts()) return;
            }
            
            const subjectSelectUI = document.getElementById('subject-select');
            const yearStageUI = document.getElementById('year-stage');
            
            const subject = subjectSelectUI ? subjectSelectUI.value : "";
            let yearText = "";
            if (yearStageUI && yearStageUI.options[yearStageUI.selectedIndex]) {
                yearText = yearStageUI.options[yearStageUI.selectedIndex].text;
            }
            
            if (!subject || !yearText) { 
                showCustomAlert("يرجى إكمال تحديد المرحلة، الصف الدراسي، والمادة العلمية أولاً.", 'error'); 
                return; 
            }
            
            if (selectedLessonFiles.length === 0) { 
                showCustomAlert("يرجى تصوير أو إرفاق صورة أولاً.", 'error'); 
                return; 
            }

            if (selectedLessonFiles.length > 10) {
                showCustomAlert("عفواً، أقصى عدد مسموح به هو 10 صور فقط في المرة الواحدة!", 'error');
                return;
            }

            const btnText = document.getElementById('btn-text');
            processBtn.classList.add('processing');
            btnText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري ضغط الصور ومعالجتها...';
            
            try {
                const newImageHash = Date.now().toString() + "_" + selectedLessonFiles.length;
                
                let summaryIdStr = subject + '_' + yearText;
                const summaryDocId = summaryIdStr.replace(/\s+/g, '_');
                const summaryRef = db.collection("summaries").doc(summaryDocId);
                const docSnap = await summaryRef.get();

                let existingData = {};
                if (docSnap.exists) {
                    existingData = docSnap.data();
                }

                btnText.innerHTML = '<i class="fas fa-compress"></i> جاري الإرسال للسيرفر الخلفي...';

                if (existingData.current_version) {
                    existingData.archived_version = { ...existingData.current_version, archived_at: new Date() };
                }

                const imagesBase64List = [];
                for (let file of selectedLessonFiles) {
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = function(event) {
                            const img = new Image();
                            img.onload = function() {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 1200;
                                const MAX_HEIGHT = 1200;
                                let width = img.width;
                                let height = img.height;

                                if (width > height) {
                                    if (width > MAX_WIDTH) {
                                        height *= MAX_WIDTH / width;
                                        width = MAX_WIDTH;
                                    }
                                } else {
                                    if (height > MAX_HEIGHT) {
                                        width *= MAX_HEIGHT / height;
                                        height = MAX_HEIGHT;
                                    }
                                }
                                
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                resolve(dataUrl.split(',')[1]);
                            };
                            img.onerror = reject;
                            img.src = event.target.result;
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    imagesBase64List.push(base64);
                }

                const formatDropdown = document.getElementById('study-material-format');
                const selectedFormat = formatDropdown ? formatDropdown.value : 'pdf-qa';
                const isExamMode = (selectedFormat === 'exam-focus');
                const isSummaryMode = (selectedFormat === 'summary');

                const foreignLanguages = ["اللغة الإنجليزية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", "english", "french", "german", "italian"];
                const isForeignLang = foreignLanguages.some(lang => subject.toLowerCase().includes(lang));
                const targetLang = isForeignLang ? "the EXACT specific foreign language of the subject (e.g., English, French, German, or Italian)" : "Arabic";

                let aiPrompt = `MANDATORY_STRICT_INSTRUCTION: YOU ARE THE CHIEF EXAM CREATOR FOR THE EGYPTIAN MINISTRY OF EDUCATION (2026). YOU MUST GENERATE CONTENT THAT EXACTLY MATCHES THE EGYPTIAN NATIONAL CURRICULUM EXAM STANDARDS FOR "${yearText}" IN SUBJECT "${subject}".
CRITICAL LANGUAGE INSTRUCTION: The output language MUST BE STRICTLY in ${targetLang}. If the subject is a foreign language, ALL questions, answers, and explanations MUST be written in that foreign language. Do not use Arabic unless it is a standard translation question explicitly required by the Egyptian Ministry.

OUTPUT FORMAT: You MUST return a JSON object containing an array named 'qa_data'. Each item in 'qa_data' must have: 'q' (the question or section title), 'a' (the answer or full explanation), 'reason' (detailed scientific/logical justification), 'type' (MCQ, TF, or ESSAY), and 'options' (array of 4 choices if MCQ).

MINISTRY SPECS BY SUBJECT:
1. IF SUMMARY MODE (${isSummaryMode}): Generate a highly detailed study summary matching Egyptian standards. Use clear comparisons, scientific reasons, and key concepts. NO EXAM QUESTIONS. Set type to 'ESSAY'.
2. ENGLISH LANGUAGE: ABSOLUTELY NO TRUE/FALSE. Use ONLY MCQ (Grammar/Vocab), Fill in the blanks (text with word box), Reading Comprehension MCQ, Unscramble sentences, and correct the grammar. 
3. SECOND LANGUAGES (FRENCH/GERMAN/ITALIAN): Use Reading Documents (True/False & MCQ), Daily Situations (MCQ), Grammar (MCQ), and short email production.
4. ARABIC LANGUAGE: Focus on Free Reading (قراءة متحررة), Poetry (نصوص متحررة), Grammar & Morphology (نحو وصرف) with parsing (إعراب) and extraction (استخراج).
5. SCIENCES & MATH (الرياضيات والعلوم): Focus on scientific reasons, comparisons, laws, and applied problem-solving with full detailed steps. Use clear mathematical logic and explain steps.
6. SOCIAL STUDIES: Focus on map deduction, historical results (ما النتائج المترتبة على), and evidence (دلل تاريخيا).
ALL MCQs AND TRUE/FALSE MUST HAVE DETAILED REASONS. THE TONE MUST BE 100% IDENTICAL TO OFFICIAL EGYPTIAN EXAMS. DO NOT DEVIATE.`;

                const serverPayload = {
                    action: 'analyze',
                    images_base64: imagesBase64List,
                    subject: subject,
                    year: yearText,
                    mime_type: 'image/jpeg',
                    output_language: 'same_as_source',
                    detailed_answers: true,
                    preserve_math_givens: true,
                    include_mcq_with_reasons: !isSummaryMode,
                    include_tf_with_reasons: !isSummaryMode,
                    hide_answers_in_exam: isExamMode,
                    strict_prompt_command: aiPrompt,
                    min_questions_per_section: isSummaryMode ? 5 : 5,
                    max_questions_per_section: isSummaryMode ? 20 : 15,
                    question_counts: {
                        mcq: isSummaryMode ? 0 : 5,
                        true_false: isSummaryMode ? 0 : 5,
                        essay: isSummaryMode ? 5 : 5,
                        strict_min_per_section: isSummaryMode ? 5 : 5,
                        strict_max_per_section: isSummaryMode ? 20 : 15
                    },
                    difficulty_levels: ["easy", "medium", "hard"]
                };

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Bypass-Trial': 'true' 
                    },
                    body: JSON.stringify(serverPayload)
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || "فشل الاتصال بالسيرفر. الكود: " + response.status);
                }

                const finalServerResponse = await response.json();

                if (finalServerResponse.error) {
                    throw new Error(finalServerResponse.error);
                }

                existingData.current_version = { 
                    imageHash: newImageHash, 
                    aiData: finalServerResponse, 
                    lastUpdated: new Date().toISOString() 
                };
                
                await summaryRef.set(existingData);
                
                btnText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تجهيز المذكرة وبناء الـ PDF...';
                
                setTimeout(() => {
                    btnText.innerHTML = '<i class="fas fa-check"></i> تم إنهاء التحليل وبناء المذكرة بنجاح';
                    processBtn.classList.remove('processing');
                    
                    showOutput(finalServerResponse, subject);
                    
                    if (isVIPLoggedIn) {
                        updateGamification(50); 
                    } else {
                        window.incrementAttempt();
                    }
                    
                    setTimeout(() => { 
                        btnText.innerHTML = '🚀 تحليل صورة أخرى'; 
                    }, 3000);
                }, 1500); 
                
            } catch (error) {
                console.error("خطأ تقني:", error);
                btnText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حدث خطأ';
                processBtn.classList.remove('processing');
                showCustomAlert("الخطأ التقني الحقيقي هو: \n" + error.message, 'error');
            }
        });
    }

    function showOutput(serverData, subjectName) {
        document.getElementById('ai-output-container').style.display = 'block';
        
        const formatDropdown = document.getElementById('study-material-format');
        const selectedFormat = formatDropdown ? formatDropdown.value : 'pdf-qa';
        const isSummaryMode = (selectedFormat === 'summary');
        
        let creationDateObj = new Date(serverData.lastUpdated || Date.now());
        document.getElementById('ai-meta-info').innerHTML = '<i class="fas fa-cloud-download-alt"></i> تاريخ الإنشاء: ' + creationDateObj.toLocaleDateString('ar-EG') + ' | المادة: ' + stripParentheses(serverData.subjectTitle || subjectName);
        
        let resultHtml = '<div style="background: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 15px; text-align: center;">';
        resultHtml += '<h4 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #0ea5e9; display: inline-block; padding-bottom: 5px;">تمت المعالجة بنجاح للمادة: ' + stripParentheses(serverData.grade || "") + ' - ' + stripParentheses(subjectName) + '</h4>';
        
        if (isSummaryMode) {
            resultHtml += '<p style="color: #059669; line-height: 1.8; font-weight: bold; font-size: 1.1rem;">تم إنشاء مذكرة شاملة وتلخيص وافي للمنهج بنجاح طبقاً لمواصفات الوزارة.</p>';
            resultHtml += '<p style="color: #64748b; font-size: 0.95rem; margin-bottom: 20px;">الملخص الجاهز للطباعة يحتوي على المقارنات، الأسباب، وأهم النقاط.</p>';
            resultHtml += '<button id="native-print-btn" class="download-pdf-btn" style="background:#0ea5e9; margin-bottom: 10px;"><i class="fas fa-file-pdf"></i> تحميل / حفظ المذكرة كملف PDF</button></div>';
        } else {
            resultHtml += '<p style="color: #059669; line-height: 1.8; font-weight: bold; font-size: 1.1rem;">تم تلخيص الصور واستخراج بنك الأسئلة طبقاً للورقة الامتحانية المصرية بنجاح.</p>';
            resultHtml += '<p style="color: #64748b; font-size: 0.95rem; margin-bottom: 20px;">الأسئلة جاهزة الآن للطباعة أو التحميل كملف PDF.</p>';
            resultHtml += '<button id="native-print-btn" class="download-pdf-btn" style="background:#0ea5e9; margin-bottom: 10px;"><i class="fas fa-file-pdf"></i> تحميل / حفظ الأسئلة كملف PDF</button></div>';
        }

        document.getElementById('ai-response-text').innerHTML = resultHtml;
        globalLessonContext = JSON.stringify(serverData.qa_data);
        
        let btnContainer = document.getElementById('interactive-exam-btn-container');
        if (btnContainer) {
            btnContainer.innerHTML = '';
            if (!isSummaryMode) {
                interactiveExamData = serverData.qa_data.filter(q => q.type === "MCQ" || q.type === "TF" || q.type === "ESSAY");
                if (interactiveExamData.length > 0) {
                    btnContainer.innerHTML = `<button id="start-interactive-exam-btn" class="action-btn" style="background:#8b5cf6; margin-top:15px; width:100%;"><i class="fas fa-stopwatch"></i> بدء الامتحان التفاعلي أونلاين الآن</button>`;
                    document.getElementById('start-interactive-exam-btn').addEventListener('click', () => {
                        startInteractiveExam(subjectName);
                    });
                }
            }
        }
        
        document.getElementById('native-print-btn').addEventListener('click', function(e) {
            e.preventDefault();
            const previewWindow = window.open('', '_blank');
            if (!previewWindow) {
                showCustomAlert("المتصفح منع النافذة. جرب السماح بالنوافذ المنبثقة.", "error");
                return;
            }
            previewWindow.document.write('<html dir="rtl"><body style="text-align:center; padding:50px; font-family:Cairo, sans-serif;"><h3>جاري كتابة ومعالجة نصوص الذكاء الاصطناعي وبناء الـ PDF...</h3><p>يرجى الانتظار ثوانٍ قليلة...</p></body></html>');

            showToast("جاري كتابة النصوص بالذكاء الاصطناعي وبناء الـ PDF...", "#0ea5e9");
            preparePDFDOM(serverData, subjectName);
            
            const elementToPrint = document.getElementById('pdf-template');
            elementToPrint.style.display = 'block';
            
            const opt = {
                margin: 0.3,
                filename: 'مذكرة_' + (subjectName || 'المنصة') + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            setTimeout(() => {
                html2pdf().set(opt).from(elementToPrint).outputPdf('blob').then(function(pdfBlob) {
                    const blobUrl = URL.createObjectURL(pdfBlob);
                    previewWindow.location.href = blobUrl;
                    elementToPrint.style.display = 'none';
                    showToast("تم بناء وتحميل المذكرة بنجاح!", "#10b981");
                }).catch(err => {
                    previewWindow.close();
                    showCustomAlert("حدث خطأ أثناء المعاينة.", "error");
                });
            }, 3500);
        });
        
        document.getElementById('ai-output-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function preparePDFDOM(serverData, subjectName) {
        const formatDropdown = document.getElementById('study-material-format');
        const selectedFormat = formatDropdown ? formatDropdown.value : 'pdf-qa';
        const isExamMode = (selectedFormat === 'exam-focus');
        const isSummaryMode = (selectedFormat === 'summary');

        let qaHtml = '';
        let questionCount = 0;
        
        const foreignLanguages = ["اللغة الإنجليزية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", "english", "french", "german", "italian"];
        const isForeignLang = foreignLanguages.some(lang => subjectName.toLowerCase().includes(lang));
        const textDirection = isForeignLang ? 'ltr' : 'rtl';
        const textAlign = isForeignLang ? 'left' : 'right';
        
        serverData.qa_data.forEach((item, index) => {
            questionCount++;
            let cleanQuestion = stripParentheses(item.q);
            
            let typeTitle = "";
            if (!isSummaryMode) {
                if (item.type === "MCQ") typeTitle = isForeignLang ? " [MCQ]" : " [اختيار من متعدد]";
                else if (item.type === "TF") typeTitle = isForeignLang ? " [True/False]" : " [صح أو خطأ]";
                else if (item.type === "ESSAY") typeTitle = isForeignLang ? " [Essay]" : " [سؤال مقالي]";
            }

            qaHtml += `<div class="pdf-question-block" style="margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border-${isForeignLang ? 'left' : 'right'}: 4px solid #10b981; direction: ${textDirection}; text-align: ${textAlign}; position: relative; z-index: 1; page-break-inside: avoid !important; break-inside: avoid !important;">`;
            
            if (isSummaryMode) {
                qaHtml += '<p style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;"><strong><i class="fas fa-star" style="color:#f59e0b;"></i> ' + cleanQuestion + '</strong></p>';
                qaHtml += '<div style="margin: 10px 0 0 0; line-height: 1.9; font-size: 15px; color: #1e293b;">' + (item.a ? item.a.replace(/\n/g, '<br>') : '') + '</div>';
                if (item.reason) {
                    qaHtml += '<div style="margin: 10px 0 0 0; line-height: 1.9; font-size: 14px; color: #059669; font-weight: bold;">' + item.reason.replace(/\n/g, '<br>') + '</div>';
                }
            } else {
                let qPrefix = isForeignLang ? 'Q ' : 'س ';
                qaHtml += '<p style="color: #0f172a; margin: 0 0 8px 0; font-size: 15px;"><strong>' + qPrefix + questionCount + ': ' + cleanQuestion + typeTitle + '</strong></p>';
                
                if (item.options && Array.isArray(item.options) && item.options.length > 0) {
                    qaHtml += '<div style="margin: 10px 0; padding: 10px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">';
                    item.options.forEach((opt) => {
                        let cleanOpt = stripParentheses(opt);
                        let isThisCorrect = (!isExamMode && item.a && (item.a.includes(cleanOpt) || cleanOpt.includes(item.a)));
                        let correctMarkText = isForeignLang ? "(✓ Correct)" : "(✓ الإجابة الصحيحة)";
                        let mark = isThisCorrect ? ` <strong style='color:#059669;'>${correctMarkText}</strong>` : "";
                        qaHtml += '<div style="margin-bottom: 6px; color: #1e293b; font-size: 14px;">• ' + cleanOpt + mark + '</div>';
                    });
                    qaHtml += '</div>';
                }

                if (!isExamMode) {
                    let trueWords = ["صح", "true", "vrai", "richtig", "vero", "✓"];
                    if (item.type === "TF") {
                        let isTrueAns = item.a && trueWords.some(w => item.a.toLowerCase().includes(w));
                        let symbolMark = isTrueAns ? "[ ✓ ]" : "[ ✕ ]";
                        let colorMark = isTrueAns ? "#059669" : "#b45309";
                        let reasonLabel = isForeignLang ? "Scientific Reason:" : "السبب العلمي:";
                        qaHtml += `<p style="margin: 10px 0 0 0; font-size: 14px; font-weight: bold; color: ${colorMark};">${symbolMark}</p>`;
                        if (item.reason) {
                            qaHtml += '<p style="margin: 6px 0 0 0; line-height: 1.8; font-size: 13px; color: #334155;"><strong>' + reasonLabel + '</strong><br>' + item.reason.replace(/\n/g, '<br>') + '</p>';
                        }
                    } else {
                        let answerLabel = isForeignLang ? "Model Answer:" : "الإجابة النموذجية:";
                        let detailLabel = isForeignLang ? "Detailed Explanation:" : "السبب والتفسير العلمي الوافي:";
                        qaHtml += '<p style="margin: 10px 0 0 0; line-height: 1.8; font-size: 13px; color: #059669;"><strong>' + answerLabel + ' </strong><br>' + item.a.replace(/\n/g, '<br>') + '</p>';
                        if (item.reason) {
                            qaHtml += '<p style="margin: 8px 0 0 0; line-height: 1.8; font-size: 13px; color: #b45309;"><strong>' + detailLabel + '</strong><br>' + item.reason.replace(/\n/g, '<br>') + '</p>';
                        }
                    }
                } else {
                    qaHtml += '<div style="margin-top: 15px; border-bottom: 1px dashed #cbd5e1; height: 25px;"></div>';
                }
            }
            
            qaHtml += '</div>';
        });

        document.getElementById('pdf-qa-content').innerHTML = qaHtml;
        document.getElementById('pdf-qa-content').style.direction = textDirection;
        document.getElementById('pdf-qa-content').style.textAlign = textAlign;
        
        let headerPrefix = isSummaryMode ? (isForeignLang ? 'Summary | ' : 'مذكرة ملخص | ') : (isForeignLang ? 'Questions | ' : 'ملف أسئلة | ');
        document.getElementById('pdf-header-title').innerText = headerPrefix + stripParentheses(serverData.subjectTitle || subjectName) + ' | ' + stripParentheses(serverData.grade || "");
        
        let pdfCreationDate = new Date(serverData.lastUpdated || Date.now()).toLocaleDateString('ar-EG');
        let footerElement = document.querySelector('#pdf-template > div > div:last-child');
        
        if (footerElement) {
            let sectionsLabel = isSummaryMode ? (isForeignLang ? ' | Generated Sections: ' : ' | عدد الأقسام المستخرجة: ') : (isForeignLang ? ' | Generated Questions: ' : ' | عدد الأسئلة المستخرجة: ');
            let watermarkText = isForeignLang ? '<br>Generated by AI Educational Platform 2026' : '<br>تم التوليد بواسطة منصة الذكاء الاصطناعي 2026';
            let dateLabel = isForeignLang ? 'Creation Date: ' : 'تاريخ الإنشاء: ';
            footerElement.innerHTML = dateLabel + pdfCreationDate + sectionsLabel + questionCount + watermarkText;
        }
    }

    function startInteractiveExam(subjectName) {
        document.getElementById('ai-output-container').classList.add('hidden-section');
        const examContainer = document.getElementById('interactive-exam-container');
        examContainer.classList.remove('hidden-section');
        
        document.getElementById('exam-subject-title').innerText = subjectName;
        
        const questionsArea = document.getElementById('exam-questions-area');
        questionsArea.innerHTML = '';
        
        interactiveExamTotalTime = interactiveExamData.length * 120;
        interactiveExamTimeLeft = interactiveExamTotalTime;
        examStartTime = Date.now();
        
        updateTimerDisplay();
        interactiveExamTimer = setInterval(() => {
            interactiveExamTimeLeft--;
            updateTimerDisplay();
            if (interactiveExamTimeLeft <= 0) {
                clearInterval(interactiveExamTimer);
                submitInteractiveExam(true);
            }
        }, 1000);

        interactiveExamData.forEach((q, index) => {
            let qDiv = document.createElement('div');
            qDiv.className = 'interactive-q-card';
            
            let qTitle = `<div class="interactive-q-title">س ${index + 1}: ${stripParentheses(q.q)}</div>`;
            let optionsHtml = '<div class="interactive-options">';
            
            if (q.type === "MCQ" && q.options && q.options.length > 0) {
                q.options.forEach((opt, optIndex) => {
                    let cleanOpt = stripParentheses(opt);
                    let inputId = `q_${index}_opt_${optIndex}`;
                    optionsHtml += `
                        <label class="option-label" for="${inputId}">
                            <input type="radio" name="q_${index}" id="${inputId}" value="${cleanOpt}" class="option-input">
                            <span>${cleanOpt}</span>
                        </label>
                    `;
                });
                optionsHtml += `<textarea id="q_${index}_text" class="student-text-answer" placeholder="اكتب إجابتك هنا..." style="width:100%; margin-top:15px; padding:12px; border-radius:8px; border:2px solid #cbd5e1; font-family: 'Cairo', sans-serif; resize:vertical; font-weight:bold;"></textarea>`;
            } else if (q.type === "TF") {
                optionsHtml += `
                    <label class="option-label" for="q_${index}_true">
                        <input type="radio" name="q_${index}" id="q_${index}_true" value="صح" class="option-input">
                        <span>صواب (صح)</span>
                    </label>
                    <label class="option-label" for="q_${index}_false">
                        <input type="radio" name="q_${index}" id="q_${index}_false" value="خطأ" class="option-input">
                        <span>خطأ</span>
                    </label>
                `;
                optionsHtml += `<textarea id="q_${index}_text" class="student-text-answer" placeholder="اكتب إجابتك هنا..." style="width:100%; margin-top:15px; padding:12px; border-radius:8px; border:2px solid #cbd5e1; font-family: 'Cairo', sans-serif; resize:vertical; font-weight:bold;"></textarea>`;
            } else if (q.type === "ESSAY") {
                optionsHtml += `<textarea id="q_${index}_text" class="student-text-answer" placeholder="اكتب إجابتك هنا..." style="width:100%; margin-top:10px; padding:12px; border-radius:8px; border:2px solid #0ea5e9; font-family: 'Cairo', sans-serif; min-height:100px; resize:vertical; font-weight:bold; font-size:1.05rem;"></textarea>`;
            }
            
            optionsHtml += '</div>';
            optionsHtml += `<div id="feedback_${index}" class="result-feedback"></div>`;
            
            qDiv.innerHTML = qTitle + optionsHtml;
            questionsArea.appendChild(qDiv);
            
            let radios = qDiv.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.addEventListener('change', function() {
                    let labels = qDiv.querySelectorAll('.option-label');
                    labels.forEach(l => l.classList.remove('selected-opt'));
                    if(this.checked) {
                        this.parentElement.classList.add('selected-opt');
                    }
                });
            });
        });

        const submitBtn = document.getElementById('submit-interactive-exam-btn');
        submitBtn.style.display = 'inline-block';
        submitBtn.onclick = () => submitInteractiveExam(false);
        
        examContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateTimerDisplay() {
        let m = Math.floor(interactiveExamTimeLeft / 60);
        let s = interactiveExamTimeLeft % 60;
        document.getElementById('exam-time-display').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (interactiveExamTimeLeft < 60) {
            document.getElementById('exam-time-display').style.color = '#ef4444';
        }
    }

    async function submitInteractiveExam(isTimeOut = false) {
        clearInterval(interactiveExamTimer);
        
        let score = 0;
        let total = interactiveExamData.length;
        let timeUsedSec = interactiveExamTotalTime - interactiveExamTimeLeft;
        
        const submitBtn = document.getElementById('submit-interactive-exam-btn');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التصحيح بالذكاء الاصطناعي...';
        submitBtn.style.pointerEvents = 'none';

        for (let index = 0; index < interactiveExamData.length; index++) {
            let q = interactiveExamData[index];
            let selectedRadio = document.querySelector(`input[name="q_${index}"]:checked`);
            let studentRadioAnswer = selectedRadio ? selectedRadio.value : null;
            let textInput = document.getElementById(`q_${index}_text`);
            let studentTextAnswer = textInput ? textInput.value.trim() : "";
            
            let feedbackDiv = document.getElementById(`feedback_${index}`);
            feedbackDiv.style.display = 'block';
            feedbackDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تقييم وفحص الإجابة...';
            
            let isCorrect = false;
            let aiFeedbackMsg = "";

            if (q.type === "MCQ" || q.type === "TF") {
                if (q.type === "MCQ") {
                    isCorrect = studentRadioAnswer && (q.a.includes(studentRadioAnswer) || studentRadioAnswer.includes(q.a));
                } else if (q.type === "TF") {
                    let correctAnswerStr = q.a.includes("صح") || q.a.includes("true") || q.a.includes("✓") ? "صح" : "خطأ";
                    isCorrect = studentRadioAnswer === correctAnswerStr;
                }
                
                if (isCorrect) score++;

                aiFeedbackMsg = `
                    <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>${isCorrect ? 'إجابة صحيحة ✓ (أنت ممتاز!)' : 'إجابة خاطئة ✕'}</strong></div>
                    ${!isCorrect ? `<div style="color: #0f172a; margin-bottom: 5px;"><strong>الإجابة العلمية المنطقية النصية بتقول:</strong> ${q.a}</div>` : ''}
                    <div style="margin-top:8px; font-size:0.95rem; color:#b45309;"><strong>السبب العلمي (ليه صح أو غلط):</strong> ${q.reason || 'لا يوجد تفسير إضافي'}</div>
                    ${studentTextAnswer ? `<div style="margin-top:8px; font-size:0.9rem; color:#64748b;"><strong>ملاحظاتك المكتوبة:</strong> ${studentTextAnswer}</div>` : ''}
                `;
                feedbackDiv.classList.add(isCorrect ? 'correct' : 'wrong');
                feedbackDiv.innerHTML = aiFeedbackMsg;

            } else if (q.type === "ESSAY") {
                if (!studentTextAnswer || studentTextAnswer.length < 2) {
                    isCorrect = false;
                    aiFeedbackMsg = `
                        <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>إجابة خاطئة ✕ (لم تقم بكتابة إجابة كافية)</strong></div>
                        <div style="color: #0f172a; margin-bottom: 5px;"><strong>الإجابة العلمية المنطقية النصية بتقول:</strong> ${q.a}</div>
                        <div style="margin-top:8px; font-size:0.95rem; color:#b45309;"><strong>السبب العلمي:</strong> ${q.reason || 'لا يوجد تفاصيل إضافية'}</div>
                    `;
                    feedbackDiv.classList.add('wrong');
                    feedbackDiv.innerHTML = aiFeedbackMsg;
                } else {
                    try {
                        const response = await fetch('/api/analyze', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'X-Bypass-Trial': 'true'
                            },
                            body: JSON.stringify({
                                action: 'semantic_grade',
                                question: q.q,
                                model_answer: q.a,
                                student_answer: studentTextAnswer
                            })
                        });
                        
                        const data = await response.json();
                        let replyText = data.reply || "{}";
                        let aiEval = JSON.parse(replyText);
                        
                        isCorrect = aiEval.isCorrect === true || aiEval.isCorrect === "true";
                        
                    } catch (e) {
                        console.error("AI Semantic Grading Failed:", e);
                        isCorrect = studentTextAnswer.length > 5; 
                    }

                    if (isCorrect) score++;

                    aiFeedbackMsg = `
                        <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>${isCorrect ? 'إجابة صحيحة ✓ (أنت ممتاز!)' : 'إجابة خاطئة ✕ (حاول التركيز أكثر)'}</strong></div>
                        <div style="color: #0f172a; margin-bottom: 5px;"><strong>الإجابة العلمية المنطقية النصية بتقول كذا كذا:</strong><br>${q.a}</div>
                        <div style="margin-top:8px; font-size:0.95rem; color:#b45309;"><strong>السبب والتفسير العلمي:</strong><br>${q.reason || 'لا توجد تفاصيل أخرى'}</div>
                    `;
                    feedbackDiv.classList.add(isCorrect ? 'correct' : 'wrong');
                    feedbackDiv.innerHTML = aiFeedbackMsg;
                }
            }
        }

        let percentage = Math.round((score / total) * 100);
        let resultMsg = isTimeOut ? "انتهى الوقت! " : "تم التصحيح والتسليم بنجاح! ";
        resultMsg += `نتيجتك النهائية: ${score} من ${total} (${percentage}%)`;
        
        showCustomAlert(resultMsg, percentage >= 50 ? 'success' : 'error');
        submitBtn.style.display = 'none';

        if (isVIPLoggedIn && score > 0) {
            updateGamification(score * 10);
            showToast(`ألف مبروك! كسبت ${score * 10} نقطة ذهبية جديدة`, "#f59e0b");
        }

        let analyticsRecord = {
            studentId: currentTeacherId || "زائر_غير_مسجل",
            subject: document.getElementById('exam-subject-title').innerText,
            score: score,
            totalQuestions: total,
            timeUsedSec: timeUsedSec,
            timestamp: Date.now()
        };

        if (navigator.onLine) {
            try {
                await db.collection("exam_analytics").add(analyticsRecord);
            } catch (e) {
                await localDBHelper.saveAnalyticsLocally(analyticsRecord);
            }
        } else {
            await localDBHelper.saveAnalyticsLocally(analyticsRecord);
        }
    }

    const tutorFabBtn = document.getElementById('tutor-fab-btn');
    const tutorChatWindow = document.getElementById('tutor-chat-window');
    const closeTutorBtn = document.getElementById('close-tutor-btn');
    
    const immersiveInput = document.getElementById('tutor-input');
    const immersiveSendBtn = document.getElementById('tutor-send-btn');
    const immersiveMessagesArea = document.getElementById('tutor-messages');
    
    const chatInputArea = immersiveInput ? immersiveInput.parentElement : null;
    let chatUploadedImagesBase64 = [];

    if (chatInputArea && !document.getElementById('attach-ai-btn')) {
        
        const attachBtn = document.createElement('button');
        attachBtn.id = 'attach-ai-btn';
        attachBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
        attachBtn.style.cssText = 'background: #0ea5e9; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; box-shadow: 0 4px 10px rgba(14, 165, 233, 0.3); transition: 0.2s; margin-left: 8px; flex-shrink: 0;';
        
        const voiceBtn = document.createElement('button');
        voiceBtn.id = 'voice-ai-btn';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.cssText = 'background: #f59e0b; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3); transition: 0.2s; margin-left: 8px; flex-shrink: 0;';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        chatInputArea.insertBefore(voiceBtn, immersiveInput);
        chatInputArea.insertBefore(attachBtn, immersiveInput);
        chatInputArea.appendChild(fileInput);

        attachBtn.onclick = () => {
            fileInput.click();
        };
        
        fileInput.addEventListener('change', async (event) => {
            if (event.target.files.length > 0) {
                if (event.target.files.length > 10) {
                    showCustomAlert("عفواً، أقصى عدد للصور هو 10 صور فقط للمرة الواحدة.", "error");
                    event.target.value = "";
                    return;
                }
                chatUploadedImagesBase64 = [];
                for (let file of event.target.files) {
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    chatUploadedImagesBase64.push(base64);
                }
                showToast(`تم إرفاق ${chatUploadedImagesBase64.length} صور للروبوت بنجاح!`, "#10b981");
                attachBtn.style.background = "#10b981"; 
            }
        });

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'ar-EG'; 
            recognition.onstart = () => {
                voiceBtn.style.background = '#ef4444';
            };
            recognition.onend = () => {
                voiceBtn.style.background = '#f59e0b';
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                immersiveInput.value = transcript;
                sendImmersiveQuestion();
            };
            voiceBtn.onclick = () => {
                recognition.start();
            };
        } else {
            voiceBtn.onclick = () => {
                showCustomAlert("عفواً، متصفحك الحالي لا يدعم ميزة التعرف الصوتي المباشر.", "error");
            };
        }
    }

    function removeEmojisForTTS(text) {
        if (!text) return "";
        let cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
        cleanText = cleanText.replace(/[*#_]/g, '');
        return cleanText;
    }

    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let cleanText = removeEmojisForTTS(text);
            let utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'ar-EG'; 
            utterance.rate = 1.05; 
            window.speechSynthesis.speak(utterance);
        }
    }

    if (tutorFabBtn && tutorChatWindow) {
        tutorFabBtn.onclick = async (e) => {
            e.preventDefault();

            if (!isVIPLoggedIn || currentUserRole === "Free") {
                showCustomAlert(`
                    عفواً، المعلم الذكي (الروبوت) متاح فقط لحسابات الـ VIP المدفوعة.<br><br>
                    <strong>تفاصيل الاشتراك:</strong><br>
                    • للطلاب: من 100 إلى 300 جنيه (خصم 25% كل 3 شهور للحد الأقصى).<br>
                    • للمدرسين: من 200 إلى 600 جنيه (خصم 25% كل 2 إلى 3 شهور للحد الأقصى).<br><br>
                    سيتم تحويلك الآن لتفعيل اشتراك الـ VIP.
                `, 'error');

                setTimeout(() => {
                    createAuthScreen();
                    document.getElementById('auth-user-card').style.display = 'none';
                    document.getElementById('auth-payment-card').style.display = 'block';
                    document.getElementById('auth-overlay').style.display = 'flex';
                }, 2200);
                return;
            }

            if ('speechSynthesis' in window) {
                let silentUtterance = new SpeechSynthesisUtterance('');
                window.speechSynthesis.speak(silentUtterance);
            }
            tutorChatWindow.style.display = 'flex';
            setTimeout(() => {
                tutorChatWindow.style.opacity = '1';
                tutorChatWindow.style.transform = 'scale(1)';
            }, 50);
        };
    }

    if (closeTutorBtn) {
        closeTutorBtn.onclick = () => {
            tutorChatWindow.style.opacity = '0';
            tutorChatWindow.style.transform = 'scale(0.8)';
            setTimeout(() => { tutorChatWindow.style.display = 'none'; }, 300);
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }

    function appendImmersiveMessage(text, sender) {
        if (!immersiveMessagesArea) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = sender === 'user' ? 'tutor-msg user-msg' : 'tutor-msg bot-msg';
        
        if(sender === 'user') {
            msgDiv.style.cssText = "align-self: flex-end; background: linear-gradient(135deg, #0ea5e9, #3b82f6); color: white; border-radius: 15px 15px 0 15px; padding: 14px 18px; max-width: 85%; font-family: 'Cairo', sans-serif;";
        } else {
            msgDiv.style.cssText = "align-self: flex-start; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 15px 15px 15px 0; padding: 14px 18px; max-width: 85%; font-family: 'Cairo', sans-serif;";
        }
        
        msgDiv.innerHTML = text.replace(/\n/g, '<br>');
        immersiveMessagesArea.appendChild(msgDiv);
        immersiveMessagesArea.scrollTop = immersiveMessagesArea.scrollHeight;
    }

    async function sendImmersiveQuestion() {
        const text = immersiveInput.value.trim();
        if (!text && chatUploadedImagesBase64.length === 0) return;
        
        let displayUserMsg = text;
        if (chatUploadedImagesBase64.length > 0) {
            displayUserMsg += `<br><span style="color:#f59e0b; font-size:0.85rem;"><i class="fas fa-image"></i> (مرفق ${chatUploadedImagesBase64.length} صور)</span>`;
        }
        
        appendImmersiveMessage(displayUserMsg || "أرجو شرح الصور المرفقة", 'user');
        immersiveInput.value = '';

        const typingId = 'imm-typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.style.cssText = "align-self: flex-start; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 15px 15px 15px 0; padding: 14px 18px; max-width: 85%; font-family: 'Cairo', sans-serif;";
        typingDiv.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i> جاري التفكير...';
        immersiveMessagesArea.appendChild(typingDiv);
        immersiveMessagesArea.scrollTop = immersiveMessagesArea.scrollHeight;

        let finalReply = "";

        try {
            if (chatUploadedImagesBase64.length > 0) {
                let chatPrompt = `MANDATORY: YOU MUST EXPLAIN ENTIRELY IN PURE EGYPTIAN COLLOQUIAL ARABIC (عامية مصرية بحتة). DO NOT USE FORMAL ARABIC (فصحى). الطالب يسألك بخصوص الصور المرفقة ويقول: "${text}". اشرح له بأسلوب مبسط جداً وبالعامية المصرية الطبيعية (كأنك مدرس مصري خبير). لا تستخدم اللغة العربية الفصحى المعقدة. IF THE SUBJECT INCLUDES MATH (الرياضيات), EXPLAIN THE STEPS LOGICALLY AND CLEARLY. هام جداً: يجب أن يكون الرد مصفوفة JSON متوافقة تماماً مع هذا التنسيق: {"brief_explanation": "اكتب الشرح المباشر للطالب بالعامية المصرية هنا مع حل المسائل بالخطوات", "qa_list": []}`;
                
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Bypass-Trial': 'true' 
                    },
                    body: JSON.stringify({
                        action: 'analyze',
                        images_base64: chatUploadedImagesBase64,
                        subject: 'سؤال حر',
                        year: 'عام',
                        mime_type: 'image/jpeg',
                        strict_prompt_command: chatPrompt
                    })
                });

                if (!response.ok) throw new Error("Server error");
                const data = await response.json();
                finalReply = data.brief_explanation || "تم استلام الصور ولكن لم أتمكن من استخراج الشرح المباشر.";
                
                chatUploadedImagesBase64 = [];
                const attachBtn = document.getElementById('attach-ai-btn');
                if (attachBtn) attachBtn.style.background = "#0ea5e9"; 

            } else {
                let currentYear = document.getElementById('year-stage')?.options[document.getElementById('year-stage')?.selectedIndex]?.text || "غير محدد";
                let mainStageVal = document.getElementById('main-stage')?.value || "";
                
                let customPrompt = "MANDATORY_STRICT_INSTRUCTION: YOU ARE A FRIENDLY, HUMAN-LIKE EXPERT EGYPTIAN TEACHER. ";
                customPrompt += "CRITICAL RULE: YOU MUST SPEAK AND EXPLAIN ENTIRELY IN PURE EGYPTIAN COLLOQUIAL ARABIC (عامية مصرية بحتة في كل كلمة). DO NOT USE FORMAL ARABIC (لغة فصحى) AT ALL. ";
                customPrompt += "YOU MUST RESPOND IMMEDIATELY AND DIRECTLY TO THE STUDENT'S QUESTION. ";
                customPrompt += "IF THE SUBJECT INCLUDES MATH (الرياضيات), EXPLAIN THE STEPS LOGICALLY AND CLEARLY IN EGYPTIAN ARABIC. ";
                
                if (mainStageVal.includes('primary')) {
                    customPrompt += "THE STUDENT IS IN PRIMARY SCHOOL (" + currentYear + "). EXPLAIN IN A VERY SIMPLE, CLEAR, AND ENGAGING WAY SUITABLE FOR CHILDREN.";
                } else if (mainStageVal.includes('prep')) {
                    customPrompt += "THE STUDENT IS IN PREPARATORY SCHOOL (" + currentYear + "). EXPLAIN SIMPLY BUT PROVIDE A COMPREHENSIVE AND STRUCTURED EXPLANATION FOR THE QUESTION WITH STEP BY STEP MATH LOGIC IF NEEDED.";
                } else if (mainStageVal.includes('high') || mainStageVal.includes('diploma')) {
                    customPrompt += "THE STUDENT IS IN SECONDARY SCHOOL/DIPLOMA (" + currentYear + "). EXPLAIN USING ALL AVAILABLE METHODS, PROVIDE DEEP ACADEMIC ANALYSIS, EXAMPLES, AND THOROUGH DETAILS, ESPECIALLY FOR MATH AND PHYSICS.";
                }

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Bypass-Trial': 'true' 
                    },
                    body: JSON.stringify({
                        action: 'chat',
                        message: text,
                        context: globalLessonContext,
                        strict_prompt_command: customPrompt
                    })
                });

                if (!response.ok) throw new Error("Server error");
                const data = await response.json();
                finalReply = data.answer || data.reply || data.message || "لا يوجد رد متاح.";
            }

            document.getElementById(typingId).remove();
            appendImmersiveMessage(finalReply, 'bot');
            
            speakText(finalReply); 
            
        } catch (err) {
            if(document.getElementById(typingId)) document.getElementById(typingId).remove();
            appendImmersiveMessage("عذراً، حدث خطأ في الاتصال بالشبكة. 🤖", 'bot');
        }
    }

    if (immersiveSendBtn && immersiveInput) {
        immersiveSendBtn.addEventListener('click', sendImmersiveQuestion);
        immersiveInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendImmersiveQuestion();
        });
    }

    let robotHeadGroup = null;
    let robotJaw = null;
    let isRobotTalking = false;
    let mouseX = 0;
    let mouseY = 0;

    function init3DRobot() {
        const container = document.getElementById('tutor-3d-canvas-container');
        if (!container || typeof THREE === 'undefined') return;
        if (container.innerHTML.includes('canvas')) return;
        container.innerHTML = ''; 
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 7); 
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio); 
        container.appendChild(renderer.domElement);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(2, 5, 5);
        scene.add(dirLight);
        robotHeadGroup = new THREE.Group();
        const headGeo = new THREE.BoxGeometry(2.4, 1.8, 2.2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.5 });
        const upperHead = new THREE.Mesh(headGeo, headMat);
        upperHead.position.set(0, 0.5, 0);
        robotHeadGroup.add(upperHead);
        const visorGeo = new THREE.BoxGeometry(2.45, 0.7, 2.25);
        const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 0.6, 0);
        robotHeadGroup.add(visor);
        const eyeGeo = new THREE.CircleGeometry(0.18, 32);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.6, 0.6, 1.13);
        robotHeadGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.6, 0.6, 1.13);
        robotHeadGroup.add(rightEye);
        const jawGeo = new THREE.BoxGeometry(2.3, 0.7, 2.1);
        const jawMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
        robotJaw = new THREE.Mesh(jawGeo, jawMat);
        robotJaw.position.set(0, -0.8, 0);
        robotHeadGroup.add(robotJaw);
        const mouthGeo = new THREE.BoxGeometry(1.8, 0.9, 1.8);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 }); 
        const mouthCore = new THREE.Mesh(mouthGeo, mouthMat);
        mouthCore.position.set(0, -0.4, 0);
        robotHeadGroup.add(mouthCore);
        scene.add(robotHeadGroup);
        const placeholder = container.querySelector('.tutor-3d-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();
            if (robotHeadGroup) {
                robotHeadGroup.rotation.y += (mouseX * 0.4 - robotHeadGroup.rotation.y) * 0.1;
                robotHeadGroup.rotation.x += (-mouseY * 0.2 - robotHeadGroup.rotation.x) * 0.1;
                robotHeadGroup.position.y = Math.sin(time * 2) * 0.1;
                if (isRobotTalking && robotJaw) {
                    const jawDrop = Math.abs(Math.sin(time * 20)) * 0.25; 
                    robotJaw.position.y = -0.8 - jawDrop; 
                } else if (robotJaw) {
                    robotJaw.position.y = -0.8; 
                }
            }
            renderer.render(scene, camera);
        }
        animate();
    }

    function startRobotTalking(durationMs) {
        isRobotTalking = true;
        setTimeout(() => {
            isRobotTalking = false;
        }, durationMs);
    }

}); // نهاية المستند
