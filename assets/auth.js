// auth.js - Xử lý đăng nhập và đăng ký tài khoản
import { auth, db, onAuthStateChanged } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { waitForAuth } from "./utils.js";

// Kiểm tra nếu đã đăng nhập
onAuthStateChanged(auth, async (user) => {
    // Chỉ kiểm tra trên trang đăng nhập/đăng ký
    if (user && (window.location.pathname.includes('index.html') || window.location.pathname.includes('register.html'))) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            // Chỉ chuyển đến trang chính nếu người dùng đã được duyệt (không phải đang chờ)
            if (userDoc.exists() && userDoc.data().role !== "pending") {
                window.location.href = "dashboard.html";
            }
        } catch (error) {
            console.error("Lỗi khi kiểm tra trạng thái người dùng:", error);
        }
    }
});

// Xử lý đăng ký
document.getElementById("registerBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("name")?.value;
    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (!name || !email || !password) {
        alert("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Gửi email xác thực
        await sendEmailVerification(user);
        
        await setDoc(doc(db, "users", user.uid), {
            name,
            email,
            role: "pending", // Cần admin duyệt
            createdAt: new Date().toISOString(),
            emailVerified: false
        });

        alert("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập.");
        
        // Đăng xuất ngay lập tức sau khi đăng ký để tránh tự động đăng nhập
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            alert("Email này đã được sử dụng!");
        } else if (error.code === 'auth/weak-password') {
            alert("Mật khẩu cần ít nhất 6 ký tự!");
        } else {
            alert("Lỗi đăng ký: " + error.message);
        }
    }
});

// Xử lý đăng nhập
document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDoc = await getDoc(doc(db, "users", user.uid));

        // Kiểm tra xác thực email
        if (!user.emailVerified) {
            alert("Vui lòng xác thực email của bạn trước khi đăng nhập.");
            // Gửi lại email xác thực nếu người dùng cần
            await sendEmailVerification(user);
            await signOut(auth);
            return;
        }

        // Kiểm tra vai trò người dùng
        if (userDoc.exists() && userDoc.data().role !== "pending") {
            // Cập nhật trạng thái xác thực email trong Firestore
            if (user.emailVerified && (!userDoc.data().emailVerified || userDoc.data().emailVerified === false)) {
                await setDoc(doc(db, "users", user.uid), { 
                    emailVerified: true 
                }, { merge: true });
            }
            window.location.href = "dashboard.html";
        } else {
            alert("Tài khoản chưa được duyệt bởi admin!");
            await signOut(auth);
        }
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert("Sai email hoặc mật khẩu!");
        } else {
            alert("Lỗi đăng nhập: " + error.message);
        }
    }
});

// Hỗ trợ phím Enter cho form đăng nhập/đăng ký
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        if (document.getElementById('registerBtn')) {
            document.getElementById('registerBtn').click();
        } else if (document.getElementById('loginBtn')) {
            document.getElementById('loginBtn').click();
        }
    }
});
