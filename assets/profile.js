// profile.js - Quản lý thông tin cá nhân
import { db, auth } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { setupMenuToggle, checkAdminRole, waitForAuth } from "./utils.js";

// Khởi tạo chức năng menu
setupMenuToggle();

// Tải dữ liệu hồ sơ người dùng
async function loadProfileData() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            console.error("Không tìm thấy dữ liệu người dùng");
            return;
        }
        
        const userData = userDoc.data();
        
        // Đặt chữ cái đầu tiên của tên
        const profileInitial = document.getElementById("profileInitial");
        if (profileInitial) {
            profileInitial.textContent = userData.name ? userData.name.charAt(0).toUpperCase() : "?";
        }
        
        // Điền thông tin vào form
        document.getElementById("profileName").value = userData.name || "";
        document.getElementById("profileEmail").value = userData.email || "";
        document.getElementById("profileBirthday").value = userData.birthday || "";
        document.getElementById("profilePhone").value = userData.phone || "";
        document.getElementById("profileAddress").value = userData.address || "";
        document.getElementById("profileHometown").value = userData.hometown || "";
        
        // Đặt vai trò với nhãn phù hợp
        let roleText = "Thành viên";
        if (userData.role === "admin") roleText = "Quản trị viên";
        else if (userData.role === "teacher") roleText = "Giáo viên";
        else if (userData.role === "pending") roleText = "Chờ duyệt";
        
        document.getElementById("profileRole").value = roleText;
        
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu hồ sơ:", error);
        alert("Không thể tải thông tin hồ sơ. Vui lòng thử lại sau.");
    }
}

// Bật chế độ chỉnh sửa các trường hồ sơ
function enableProfileEditing() {
    const editableFields = [
        "profileName", 
        "profileBirthday", 
        "profilePhone", 
        "profileAddress", 
        "profileHometown"
    ];
    
    editableFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.disabled = false;
            field.classList.add("border-blue-300");
            field.classList.add("bg-blue-50");
        }
    });
    
    // Ẩn nút chỉnh sửa, hiện nút lưu và hủy
    document.getElementById("editProfileBtn").classList.add("hidden");
    document.getElementById("saveProfileBtn").classList.remove("hidden");
    document.getElementById("cancelProfileBtn").classList.remove("hidden");
}

// Tắt chế độ chỉnh sửa các trường hồ sơ
function disableProfileEditing() {
    const editableFields = [
        "profileName", 
        "profileBirthday", 
        "profilePhone", 
        "profileAddress", 
        "profileHometown"
    ];
    
    editableFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.disabled = true;
            field.classList.remove("border-blue-300");
            field.classList.remove("bg-blue-50");
        }
    });
    
    // Hiện nút chỉnh sửa, ẩn nút lưu và hủy
    document.getElementById("editProfileBtn").classList.remove("hidden");
    document.getElementById("saveProfileBtn").classList.add("hidden");
    document.getElementById("cancelProfileBtn").classList.add("hidden");
}

// Lưu thông tin hồ sơ
async function saveProfileChanges() {
    const user = auth.currentUser;
    if (!user) {
        alert("Bạn cần đăng nhập để lưu thông tin!");
        return;
    }
    
    const name = document.getElementById("profileName").value;
    const birthday = document.getElementById("profileBirthday").value;
    const phone = document.getElementById("profilePhone").value;
    const address = document.getElementById("profileAddress").value;
    const hometown = document.getElementById("profileHometown").value;
    
    // Kiểm tra cơ bản
    if (!name.trim()) {
        alert("Vui lòng nhập họ và tên!");
        return;
    }
    
    try {
        // Cập nhật dữ liệu người dùng trong Firestore
        await updateDoc(doc(db, "users", user.uid), {
            name,
            birthday,
            phone,
            address,
            hometown,
            updatedAt: new Date().toISOString()
        });
        
        alert("Cập nhật thông tin thành công!");
        disableProfileEditing();
        
        // Cập nhật chữ cái đầu tiên
        document.getElementById("profileInitial").textContent = name.charAt(0).toUpperCase();
        
        // Cập nhật tên người dùng trong header
        const usernameElement = document.getElementById("username");
        if (usernameElement) {
            usernameElement.textContent = `Xin chào, ${name}`;
        }
        
    } catch (error) {
        console.error("Lỗi khi cập nhật thông tin:", error);
        alert("Không thể cập nhật thông tin. Vui lòng thử lại.");
    }
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Chờ xác thực sẵn sàng
        const user = await waitForAuth();
        
        if (user) {
            loadProfileData();
            await checkAdminRole();
        } else {
            window.location.href = "index.html";
        }
        
        // Nút chỉnh sửa hồ sơ
        document.getElementById("editProfileBtn")?.addEventListener("click", enableProfileEditing);
        
        // Nút lưu hồ sơ
        document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfileChanges);
        
        // Nút hủy chỉnh sửa
        document.getElementById("cancelProfileBtn")?.addEventListener("click", () => {
            disableProfileEditing();
            loadProfileData(); // Tải lại dữ liệu ban đầu
        });
    } catch (error) {
        console.error("Lỗi khởi tạo trang hồ sơ:", error);
    }
});
