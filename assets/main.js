// main.js - Xử lý chính cho xác thực người dùng
import { auth, signOut, onAuthStateChanged } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { checkAdminRole, waitForAuth } from "./utils.js";

// Kiểm tra trạng thái đăng nhập
onAuthStateChanged(auth, async (user) => {
    // Nếu không có người dùng đăng nhập, chuyển đến trang đăng nhập
    if (!user) {
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('register.html')) {
            window.location.href = "index.html";
        }
        return;
    }
    
    try {
        // Kiểm tra nếu đang ở trang cần xác thực
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('register.html')) {
            
            // Kiểm tra vai trò người dùng
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            // Nếu tài liệu người dùng không tồn tại hoặc vai trò đang chờ duyệt, không cho phép truy cập
            if (!userDoc.exists() || userDoc.data().role === "pending") {
                alert("Tài khoản của bạn vẫn đang chờ duyệt!");
                await signOut(auth);
                window.location.href = "index.html";
                return;
            }
            
            // Cập nhật tên người dùng
            const usernameElement = document.getElementById("username");
            if (usernameElement && userDoc.exists()) {
                usernameElement.textContent = `Xin chào, ${userDoc.data().name || "Người dùng"}`;
            }
            
            // Hiển thị liên kết admin nếu người dùng là admin
            await checkAdminRole();
        }
    } catch (error) {
        console.error("Lỗi khi kiểm tra thông tin người dùng:", error);
        // Khi có lỗi, an toàn nhất là đăng xuất và chuyển đến trang đăng nhập
        await signOut(auth);
        window.location.href = "index.html";
    }
});

// Xử lý đăng xuất
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        console.error("Lỗi khi đăng xuất:", error);
        alert("Có lỗi xảy ra khi đăng xuất");
    }
});
