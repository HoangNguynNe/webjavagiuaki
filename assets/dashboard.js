// dashboard.js - Trang chủ
import { db, auth } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, orderBy, limit, getDoc, doc, deleteDoc, updateDoc, where 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    setupMenuToggle, checkAdminRole, waitForAuth, getUserClasses,
    getUserRole, showLoading, showError, showEmpty, getClassName, isClassMember
} from "./utils.js";

// Khởi tạo chức năng menu
setupMenuToggle();

// Tải danh sách lớp học cho dropdown
async function loadClassDropdown() {
    const classSelect = document.getElementById("classId");
    if (!classSelect) return;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Kiểm tra vai trò người dùng
        const userRole = await getUserRole();
        const isAdmin = userRole === "admin";
        
        // Đảm bảo tùy chọn "Tất cả" luôn có ở đầu tiên
        classSelect.innerHTML = '<option value="">Tất cả</option>';
        
        // Nếu là admin, hiển thị tất cả lớp học
        if (isAdmin) {
            const querySnapshot = await getDocs(collection(db, "classes"));
            querySnapshot.forEach((docSnap) => {
                const classData = docSnap.data();
                classSelect.innerHTML += `<option value="${docSnap.id}">${classData.name}</option>`;
            });
        } else {
            // Nếu là thành viên hoặc giáo viên, chỉ hiển thị lớp học mà họ tham gia
            const userClassIds = await getUserClasses(user.uid);
            
            if (userClassIds.length === 0) {
                // Không cần phải cập nhật gì cả vì "Tất cả" đã được thêm ở trên
            } else {
                for (const classId of userClassIds) {
                    const classDoc = await getDoc(doc(db, "classes", classId));
                    if (classDoc.exists()) {
                        const classData = classDoc.data();
                        classSelect.innerHTML += `<option value="${classId}">${classData.name}</option>`;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
    }
}

// Thêm bài đăng mới
async function addPost() {
    const postTitle = document.getElementById("postTitle").value;
    const postContent = document.getElementById("postContent").value;
    const classId = document.getElementById("classId").value;

    if (!postTitle || !postContent) {
        alert("Vui lòng nhập tiêu đề và nội dung");
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Bạn cần đăng nhập để đăng bài!");
            return;
        }
        
        // Kiểm tra quyền đăng bài khi chọn lớp học cụ thể
        if (classId) {
            const userRole = await getUserRole();
            if (userRole !== "admin") {
                // Kiểm tra xem người dùng có phải là thành viên của lớp học không
                const isMember = await isClassMember(classId);
                if (!isMember) {
                    alert("Bạn không phải là thành viên của lớp học này nên không thể đăng bài ở đây!");
                    return;
                }
            }
        }
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userName = userDoc.exists() ? userDoc.data().name : "Người dùng";
        
        await addDoc(collection(db, "posts"), { 
            title: postTitle, 
            content: postContent, 
            classId: classId || null,  // null nghĩa là hiển thị cho tất cả mọi người
            createdAt: new Date().toISOString(),
            authorId: user.uid,
            authorName: userName
        });
        
        alert("Bài đăng đã được tạo!");
        
        // Xóa form
        document.getElementById("postTitle").value = "";
        document.getElementById("postContent").value = "";
        document.getElementById("classId").value = "";
        
        loadRecentPosts();
    } catch (error) {
        console.error("Lỗi khi thêm bài đăng:", error);
        alert("Không thể tạo bài đăng. Vui lòng thử lại.");
    }
}

// Chỉnh sửa bài đăng - hiển thị modal thay vì prompt
async function editPost(postId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Bạn cần đăng nhập để chỉnh sửa bài đăng!");
            return;
        }
        
        // Lấy dữ liệu bài đăng hiện tại
        const postDoc = await getDoc(doc(db, "posts", postId));
        if (!postDoc.exists()) {
            alert("Không tìm thấy bài đăng!");
            return;
        }
        
        const postData = postDoc.data();
        
        // Chỉ cho phép chỉnh sửa bởi tác giả bài đăng hoặc admin
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userRole = userDoc.exists() ? userDoc.data().role : "member";
        
        if (postData.authorId !== user.uid && userRole !== "admin") {
            alert("Bạn không có quyền chỉnh sửa bài đăng này!");
            return;
        }
        
        // Điền thông tin vào modal
        document.getElementById("editPostId").value = postId;
        document.getElementById("editPostTitle").value = postData.title || "";
        document.getElementById("editPostContent").value = postData.content || "";
        
        // Hiển thị modal
        document.getElementById("editPostModal").classList.remove("hidden");
    } catch (error) {
        console.error("Lỗi khi chỉnh sửa bài đăng:", error);
        alert("Không thể chỉnh sửa bài đăng. Vui lòng thử lại.");
    }
}

// Lưu thay đổi bài đăng
async function savePostChanges() {
    const postId = document.getElementById("editPostId").value;
    const title = document.getElementById("editPostTitle").value;
    const content = document.getElementById("editPostContent").value;
    
    if (!postId || !title || !content) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Bạn cần đăng nhập để cập nhật bài đăng!");
            return;
        }

        // Lấy thông tin bài đăng hiện tại để kiểm tra quyền
        const postDoc = await getDoc(doc(db, "posts", postId));
        if (!postDoc.exists()) {
            alert("Không tìm thấy bài đăng!");
            return;
        }
        
        const postData = postDoc.data();
        const classId = postData.classId;
        
        // Lấy vai trò người dùng
        const userRole = await getUserRole(user.uid);
        const isAdmin = userRole === "admin";
        
        // Kiểm tra quyền chỉnh sửa
        if (!isAdmin && postData.authorId !== user.uid) {
            alert("Bạn không có quyền chỉnh sửa bài đăng này!");
            return;
        }
        
        // Nếu bài đăng thuộc về một lớp, kiểm tra người dùng có trong lớp học không
        if (classId) {
            const isMember = await isClassMember(classId);
            if (!isMember && !isAdmin) {
                alert("Bạn không phải là thành viên của lớp học này!");
                return;
            }
        }
        
        await updateDoc(doc(db, "posts", postId), {
            title,
            content,
            updatedAt: new Date().toISOString()
        });
        
        // Ẩn modal
        document.getElementById("editPostModal").classList.add("hidden");
        
        alert("Cập nhật bài đăng thành công!");
        loadRecentPosts();
    } catch (error) {
        console.error("Lỗi khi cập nhật bài đăng:", error);
        alert("Không thể cập nhật bài đăng. Vui lòng thử lại: " + error.message);
    }
}

// Xóa bài đăng 
async function deletePost(postId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Bạn cần đăng nhập để xóa bài đăng!");
            return;
        }
        
        // Lấy dữ liệu bài đăng để kiểm tra quyền sở hữu
        const postDoc = await getDoc(doc(db, "posts", postId));
        if (!postDoc.exists()) {
            alert("Không tìm thấy bài đăng!");
            return;
        }
        
        const postData = postDoc.data();
        
        // Chỉ cho phép xóa bởi tác giả bài đăng hoặc admin
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userRole = userDoc.exists() ? userDoc.data().role : "member";
        
        if (postData.authorId !== user.uid && userRole !== "admin") {
            alert("Bạn không có quyền xóa bài đăng này!");
            return;
        }
        
        if (!confirm("Bạn có chắc chắn muốn xóa bài đăng này?")) return;
        
        await deleteDoc(doc(db, "posts", postId));
        alert("Xóa bài đăng thành công!");
        loadRecentPosts();
    } catch (error) {
        console.error("Lỗi khi xóa bài đăng:", error);
        alert("Không thể xóa bài đăng. Vui lòng thử lại.");
    }
}

// Tải bài đăng gần đây
async function loadRecentPosts() {
    const recentPostsContainer = document.getElementById("recentPosts");
    if (!recentPostsContainer) return;
    
    showLoading(recentPostsContainer, "Đang tải bài đăng...");
    
    try {
        // Đảm bảo xác thực đã được khởi tạo
        const user = await waitForAuth();
        
        // Kiểm tra lại sau khi đợi
        if (!user) {
            showError(recentPostsContainer, "Bạn cần đăng nhập để xem bài đăng");
            return;
        }
        
        // Lấy lớp học của người dùng
        const userClassIds = await getUserClasses(user.uid);
        console.log("ID lớp học của người dùng:", userClassIds);
        
        // Lấy vai trò người dùng
        const userRole = await getUserRole();
        console.log("Vai trò người dùng:", userRole);
        
        const isAdminOrTeacher = userRole === "admin" || userRole === "teacher";
        
        // Truy vấn tất cả bài đăng
        const postsQuery = query(
            collection(db, "posts"), 
            orderBy("createdAt", "desc"), 
            limit(20)
        );
        
        const querySnapshot = await getDocs(postsQuery);
        
        if (querySnapshot.empty) {
            showEmpty(recentPostsContainer, "Chưa có bài đăng nào. Hãy là người đầu tiên đăng bài!");
            return;
        }
        
        recentPostsContainer.innerHTML = "";
        let hasVisiblePosts = false;
        
        for (const docSnap of querySnapshot.docs) {
            const postData = docSnap.data();
            
            // Hiển thị bài đăng nếu:
            // 1. Bài đăng không thuộc lớp học nào (hiển thị cho tất cả), hoặc
            // 2. Người dùng là admin/giáo viên, hoặc
            // 3. Người dùng là thành viên của lớp học đó
            if (!postData.classId || isAdminOrTeacher || (postData.classId && userClassIds.includes(postData.classId))) {
                hasVisiblePosts = true;
                const date = new Date(postData.createdAt).toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // Lấy tên lớp nếu bài đăng thuộc về một lớp
                let classLabel = "";
                if (postData.classId) {
                    const className = await getClassName(postData.classId);
                    if (className) {
                        classLabel = `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            <i class="fas fa-graduation-cap mr-1"></i>${className}
                        </span>`;
                    }
                }
                
                // Kiểm tra xem người dùng có thể chỉnh sửa/xóa bài đăng này không
                const canModifyPost = (postData.authorId === user.uid) || (userRole === "admin");
                
                // Chỉ hiển thị menu dropdown nếu người dùng có thể chỉnh sửa bài đăng
                const dropdownMenu = canModifyPost ? `
                    <div class="dropdown relative ml-2">
                        <button class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="dropdown-menu absolute right-0 mt-2 w-32 bg-white shadow-lg rounded hidden z-10">
                            <button onclick="window.editPost('${docSnap.id}')" class="w-full text-left px-4 py-2 hover:bg-gray-100">
                                <i class="fas fa-edit mr-1"></i> Sửa
                            </button>
                            <button onclick="window.deletePost('${docSnap.id}')" class="w-full text-left px-4 py-2 hover:bg-gray-100">
                                <i class="fas fa-trash mr-1"></i> Xóa
                            </button>
                        </div>
                    </div>
                ` : '';
                
                const postHtml = `
                    <div class="bg-white rounded-lg shadow-md p-4 mb-4">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="text-xl font-bold">${postData.title}</h3>
                            <div class="flex space-x-2 items-center">
                                ${classLabel}
                                ${dropdownMenu}
                            </div>
                        </div>
                        <p class="text-gray-700 mb-3">${postData.content}</p>
                        <div class="flex justify-between items-center text-sm text-gray-500">
                            <span>
                                <i class="fas fa-user mr-1"></i>${postData.authorName || 'Người dùng'}
                            </span>
                            <span>
                                <i class="far fa-clock mr-1"></i>${date}
                            </span>
                        </div>
                    </div>
                `;
                
                recentPostsContainer.innerHTML += postHtml;
            }
        }
        
        if (!hasVisiblePosts) {
            showEmpty(recentPostsContainer, "Không có bài đăng nào bạn có thể xem.");
        }
        
        // Thiết lập chức năng dropdown
        setupDropdowns();
    } catch (error) {
        console.error("Lỗi khi tải bài đăng:", error);
        showError(recentPostsContainer, `Lỗi khi tải bài đăng: ${error.message} <br> Vui lòng thử lại hoặc đăng nhập lại.`);
    }
}

// Thiết lập menu dropdown cho bài đăng
function setupDropdowns() {
    const dropdownButtons = document.querySelectorAll('.dropdown button');
    
    dropdownButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.stopPropagation();
            const menu = this.nextElementSibling;
            menu.classList.toggle('hidden');
            
            // Đóng các menu khác
            document.querySelectorAll('.dropdown-menu').forEach(otherMenu => {
                if (otherMenu !== menu) {
                    otherMenu.classList.add('hidden');
                }
            });
        });
    });
    
    // Đóng dropdowns khi nhấp vào nơi khác
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    });
}

// Tải danh sách lớp học trang chủ
async function loadDashboardClasses() {
    const classListContainer = document.getElementById("dashboardClassList");
    if (!classListContainer) return;
    
    classListContainer.innerHTML = `<li class="p-3 text-center text-gray-500">Đang tải dữ liệu...</li>`;
    
    try {
        const classesQuery = query(
            collection(db, "classes"),
            limit(5)
        );
        
        const querySnapshot = await getDocs(classesQuery);
        
        if (querySnapshot.empty) {
            classListContainer.innerHTML = `<li class="p-3 text-center text-gray-500">Chưa có lớp học nào</li>`;
            return;
        }
        
        classListContainer.innerHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const classData = docSnap.data();
            const classHtml = `
                <li class="p-3 hover:bg-gray-50">
                    <a href="classes.html" class="flex items-center">
                        <i class="fas fa-graduation-cap mr-3 text-blue-500"></i>
                        <span>${classData.name}</span>
                    </a>
                </li>
            `;
            
            classListContainer.innerHTML += classHtml;
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
        classListContainer.innerHTML = `<li class="p-3 text-center text-red-500">Lỗi khi tải dữ liệu</li>`;
    }
}

// Tải danh sách thành viên trang chủ
async function loadDashboardMembers() {
    const membersListContainer = document.getElementById("dashboardMembersList");
    if (!membersListContainer) return;
    
    membersListContainer.innerHTML = `<li class="p-3 text-center text-gray-500">Đang tải dữ liệu...</li>`;
    
    try {
        const membersQuery = query(
            collection(db, "users"),
            limit(10)
        );
        
        const querySnapshot = await getDocs(membersQuery);
        
        if (querySnapshot.empty) {
            membersListContainer.innerHTML = `<li class="p-3 text-center text-gray-500">Chưa có thành viên nào</li>`;
            return;
        }
        
        membersListContainer.innerHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (userData.role === "pending") return; // Bỏ qua người dùng đang chờ duyệt
            
            const memberHtml = `
                <li class="p-3 hover:bg-gray-50">
                    <div class="flex items-center">
                        <span class="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                            ${userData.name ? userData.name.charAt(0).toUpperCase() : '?'}
                        </span>
                        <div>
                            <div class="font-medium">${userData.name || 'Người dùng'}</div>
                            <div class="text-xs text-gray-500">${userData.role === 'admin' ? 'Quản trị viên' : userData.role === 'teacher' ? 'Giáo viên' : 'Thành viên'}</div>
                        </div>
                    </div>
                </li>
            `;
            
            membersListContainer.innerHTML += memberHtml;
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách thành viên:", error);
        membersListContainer.innerHTML = `<li class="p-3 text-center text-red-500">Lỗi khi tải dữ liệu</li>`;
    }
}

// Thêm các event listener
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Chờ xác thực sẵn sàng
        const user = await waitForAuth();
        
        if (user) {
            console.log("Đã xác thực người dùng:", user.email);
            // Bây giờ có thể tải dữ liệu
            await checkAdminRole();
            loadClassDropdown();
            loadRecentPosts();
            loadDashboardClasses();
            loadDashboardMembers();
        } else {
            console.log("Chưa xác thực người dùng");
        }
        
        document.getElementById("addPostBtn")?.addEventListener("click", addPost);
        
        // Hỗ trợ phím Enter cho tiêu đề bài đăng
        document.getElementById("postTitle")?.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                document.getElementById("postContent").focus();
            }
        });
        
        // Thêm event listeners cho modal chỉnh sửa bài đăng
        document.getElementById("cancelEditPost")?.addEventListener("click", () => {
            document.getElementById("editPostModal").classList.add("hidden");
        });
        
        document.getElementById("confirmEditPost")?.addEventListener("click", savePostChanges);
    } catch (error) {
        console.error("Lỗi khởi tạo trang chủ:", error);
    }
});

// Xuất hàm cho sử dụng trong HTML
window.editPost = editPost;
window.deletePost = deletePost;
window.savePostChanges = savePostChanges;
