// classes.js - Quản lý lớp học
import { db, auth, onAuthStateChanged } from "./firebase.js";
import { 
    collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, getCountFromServer, getDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    setupMenuToggle, isAdminOrTeacher, isClassMember,
    showLoading, showError, showEmpty, waitForAuth
} from "./utils.js";

// Khởi tạo chức năng menu
setupMenuToggle();

// Thêm lớp học mới
async function addClass() {
    const className = document.getElementById("className").value;
    const classDescription = document.getElementById("classDescription").value;
    
    if (!className) {
        alert("Vui lòng nhập tên lớp học");
        return;
    }
    
    try {
        await addDoc(collection(db, "classes"), { 
            name: className,
            description: classDescription || "",
            createdAt: new Date().toISOString()
        });
        alert("Thêm lớp học thành công!");
        document.getElementById("className").value = "";
        document.getElementById("classDescription").value = "";
        loadClasses();
    } catch (error) {
        console.error("Lỗi khi thêm lớp học:", error);
        alert("Không thể thêm lớp học. Vui lòng thử lại.");
    }
}

// Cập nhật lớp học
async function updateClass(classId) {
    try {
        // Lấy thông tin lớp học
        const classDoc = await getDoc(doc(db, "classes", classId));
        if (!classDoc.exists()) {
            alert("Không tìm thấy lớp học!");
            return;
        }
        
        const classData = classDoc.data();
        
        // Điền thông tin vào form
        document.getElementById("updateClassId").value = classId;
        document.getElementById("updateClassName").value = classData.name || "";
        document.getElementById("updateClassDescription").value = classData.description || "";
        
        // Hiển thị modal
        document.getElementById("updateClassModal").classList.remove("hidden");
    } catch (error) {
        console.error("Lỗi khi lấy thông tin lớp học:", error);
        alert("Không thể cập nhật lớp học. Vui lòng thử lại.");
    }
}

// Lưu thông tin lớp học đã cập nhật
async function saveUpdatedClass() {
    const classId = document.getElementById("updateClassId").value;
    const className = document.getElementById("updateClassName").value;
    const classDescription = document.getElementById("updateClassDescription").value;
    
    if (!className) {
        alert("Vui lòng nhập tên lớp học");
        return;
    }
    
    try {
        await updateDoc(doc(db, "classes", classId), {
            name: className,
            description: classDescription,
            updatedAt: new Date().toISOString()
        });
        
        // Ẩn modal
        document.getElementById("updateClassModal").classList.add("hidden");
        
        alert("Cập nhật lớp học thành công!");
        loadClasses();
    } catch (error) {
        console.error("Lỗi khi cập nhật lớp học:", error);
        alert("Không thể cập nhật lớp học. Vui lòng thử lại.");
    }
}

// Xóa lớp học
async function deleteClass(classId) {
    if (!confirm("Bạn có chắc muốn xóa lớp học này? Tất cả dữ liệu liên quan sẽ bị mất!")) return;
    
    try {
        await deleteDoc(doc(db, "classes", classId));
        alert("Xóa lớp học thành công!");
        loadClasses();
    } catch (error) {
        console.error("Lỗi khi xóa lớp học:", error);
        alert("Không thể xóa lớp học. Vui lòng thử lại.");
    }
}

// Lấy số lượng thành viên trong lớp
async function getMemberCount(classId) {
    try {
        const memberQuery = query(
            collection(db, "users"), 
            where("classIds", "array-contains", classId)
        );
        
        const snapshot = await getCountFromServer(memberQuery);
        return snapshot.data().count;
    } catch (error) {
        console.error("Lỗi khi đếm thành viên lớp học:", error);
        return 0;
    }
}

// Tham gia lớp học
async function joinClass(classId) {
    const user = auth.currentUser;
    if (!user) {
        alert("Bạn cần đăng nhập để tham gia lớp học!");
        return;
    }
    
    try {
        // Thêm lớp học vào danh sách lớp của người dùng
        await updateDoc(doc(db, "users", user.uid), {
            classIds: arrayUnion(classId),
            updatedAt: new Date().toISOString()
        });
        
        alert("Tham gia lớp học thành công!");
        loadClasses(); // Cập nhật lại danh sách để cập nhật nút
    } catch (error) {
        console.error("Lỗi khi tham gia lớp học:", error);
        alert("Không thể tham gia lớp học. Vui lòng thử lại.");
    }
}

// Tải danh sách lớp học
async function loadClasses() {
    const classList = document.getElementById("classList");
    if (!classList) return;
    
    showLoading(classList, "Đang tải danh sách lớp học...");
    
    try {
        const searchTerm = document.getElementById("classSearch")?.value?.toLowerCase() || '';
        const querySnapshot = await getDocs(collection(db, "classes"));
        
        if (querySnapshot.empty) {
            showEmpty(classList, "Chưa có lớp học nào. Hãy tạo lớp học đầu tiên!");
            return;
        }
        
        const classes = [];
        querySnapshot.forEach(docSnap => {
            const classData = docSnap.data();
            classes.push({
                id: docSnap.id,
                ...classData
            });
        });
        
        // Lọc lớp học theo từ khóa tìm kiếm
        const filteredClasses = searchTerm ? 
            classes.filter(cls => cls.name.toLowerCase().includes(searchTerm)) : 
            classes;
            
        if (filteredClasses.length === 0) {
            showEmpty(classList, `Không tìm thấy lớp học nào phù hợp với từ khóa "${searchTerm}"`);
            return;
        }
            
        classList.innerHTML = "";
        
        // Sắp xếp lớp học theo ngày tạo (mới nhất đầu tiên)
        filteredClasses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        const isAdmin = await isAdminOrTeacher();
        
        for (const classItem of filteredClasses) {
            const memberCount = await getMemberCount(classItem.id);
            const isMember = await isClassMember(classItem.id);
            
            const classCard = document.createElement('div');
            classCard.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition';
            classCard.innerHTML = `
                <div class="bg-blue-500 text-white p-4">
                    <h3 class="text-xl font-bold">${classItem.name}</h3>
                </div>
                <div class="p-4">
                    <p class="text-gray-600 mb-4 h-12 overflow-hidden">
                        ${classItem.description || 'Không có mô tả'}
                    </p>
                    <div class="flex items-center text-sm text-gray-500 mb-4">
                        <i class="fas fa-users mr-2"></i>
                        <span>${memberCount} thành viên</span>
                    </div>
                    <div class="flex justify-between">
                        ${isAdmin || isMember ? 
                            `<button onclick="window.viewClass('${classItem.id}')" class="px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">
                                <i class="fas fa-eye mr-1"></i>Xem
                            </button>` :
                            `<button onclick="window.joinClass('${classItem.id}')" class="px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                <i class="fas fa-sign-in-alt mr-1"></i>Tham gia
                            </button>`
                        }
                        ${isAdmin ? `
                        <div>
                            <button onclick="window.updateClass('${classItem.id}')" class="px-3 py-1 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="window.deleteClass('${classItem.id}')" class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            classList.appendChild(classCard);
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
        showError(classList, "Lỗi khi tải dữ liệu! Vui lòng thử lại sau.");
    }
}

// Xem chi tiết lớp học
async function viewClass(classId) {
    try {
        // Lấy thông tin lớp học
        const classDoc = await getDoc(doc(db, "classes", classId));
        if (!classDoc.exists()) {
            alert("Không tìm thấy lớp học!");
            return;
        }
        
        const classData = classDoc.data();
        
        // Điền thông tin vào modal
        document.getElementById("viewClassName").textContent = classData.name || "Không có tên";
        document.getElementById("viewClassDescription").textContent = classData.description || "Không có mô tả";
        
        // Tải danh sách thành viên trong lớp
        const classMembers = document.getElementById("classMembers");
        classMembers.innerHTML = "<tr><td colspan='3' class='text-center py-4'>Đang tải danh sách thành viên...</td></tr>";
        
        const membersQuery = query(
            collection(db, "users"),
            where("classIds", "array-contains", classId)
        );
        
        const querySnapshot = await getDocs(membersQuery);
        
        if (querySnapshot.empty) {
            classMembers.innerHTML = "<tr><td colspan='3' class='text-center py-4'>Chưa có thành viên nào trong lớp học này</td></tr>";
        } else {
            classMembers.innerHTML = "";
            querySnapshot.forEach((userDoc) => {
                const userData = userDoc.data();
                let roleText = "Thành viên";
                if (userData.role === "admin") roleText = "Quản trị viên";
                else if (userData.role === "teacher") roleText = "Giáo viên";
                
                const row = `
                    <tr class="border-b">
                        <td class="px-4 py-2">${userData.name || "Không có tên"}</td>
                        <td class="px-4 py-2">${userData.email || "Không có email"}</td>
                        <td class="px-4 py-2">${roleText}</td>
                    </tr>
                `;
                classMembers.innerHTML += row;
            });
        }
        
        // Hiển thị modal
        document.getElementById("viewClassModal").classList.remove("hidden");
        
    } catch (error) {
        console.error("Lỗi khi xem chi tiết lớp học:", error);
        alert("Không thể xem chi tiết lớp học. Vui lòng thử lại.");
    }
}

// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Chờ xác thực người dùng
        await waitForAuth();
        
        const user = auth.currentUser;
        if (!user) {
            console.error("Người dùng chưa đăng nhập");
            return;
        }
        
        const isAdmin = await isAdminOrTeacher();
        console.log("Người dùng là admin hoặc giáo viên:", isAdmin);
        
        // Hiển thị/ẩn form tạo lớp học dựa vào vai trò người dùng
        const createClassSection = document.querySelector('.lg\\:col-span-1');
        if (createClassSection) {
            if (!isAdmin) {
                // Với thành viên thường, thay thế bằng mục "Lớp học của tôi"
                createClassSection.innerHTML = `
                    <div class="bg-white p-4 rounded-lg shadow-md mb-6">
                        <h3 class="text-lg font-semibold mb-4">Lớp học của tôi</h3>
                        <ul id="userClassesList" class="divide-y">
                            <li class="py-3 text-center text-gray-500">
                                <i class="fas fa-spinner fa-spin mr-2"></i> Đang tải...
                            </li>
                        </ul>
                    </div>
                    
                    <div class="bg-white p-4 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold mb-4">Tìm kiếm lớp học</h3>
                        <div class="flex space-x-2">
                            <input id="classSearch" type="text" placeholder="Tên lớp học" class="w-full px-3 py-2 border rounded">
                            <button id="searchBtn" class="bg-blue-500 text-white px-4 py-2 rounded">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                // Tải lớp học của người dùng
                loadUserClasses();
            }
        }
        
        // Tải danh sách lớp học - chỉ gọi một lần
        loadClasses();
        
        if (isAdmin) {
            document.getElementById("addClassBtn")?.addEventListener("click", addClass);
        }
        
        // Thêm chức năng tìm kiếm
        document.getElementById("searchBtn")?.addEventListener("click", loadClasses);
        document.getElementById("classSearch")?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") loadClasses();
        });
        
        // Lắng nghe sự kiện cho modal
        document.getElementById("cancelUpdateClass")?.addEventListener("click", () => {
            document.getElementById("updateClassModal").classList.add("hidden");
        });
        
        document.getElementById("confirmUpdateClass")?.addEventListener("click", saveUpdatedClass);
        
        document.getElementById("closeViewClassModal")?.addEventListener("click", () => {
            document.getElementById("viewClassModal").classList.add("hidden");
        });
        
        document.getElementById("closeViewClassBtn")?.addEventListener("click", () => {
            document.getElementById("viewClassModal").classList.add("hidden");
        });
    } catch (error) {
        console.error("Lỗi khởi tạo trang lớp học:", error);
    }
});

// Tải lớp học của người dùng cho sidebar
async function loadUserClasses() {
    try {
        // Đảm bảo xác thực đã sẵn sàng và người dùng khả dụng
        if (!auth.currentUser) {
            await waitForAuth();
        }
        
        const user = auth.currentUser;
        if (!user) {
            console.error("Người dùng chưa xác thực");
            return;
        }
        
        console.log("Đang tải lớp học cho người dùng ID:", user.uid);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            console.log("Không tìm thấy tài liệu người dùng");
            return;
        }
        
        const userData = userDoc.data();
        const userClassIds = userData.classIds || [];
        
        console.log("ID lớp học của người dùng:", userClassIds);
        
        // Tải lớp học
        const classesListElement = document.getElementById('userClassesList');
        if (classesListElement) {
            if (userClassIds.length === 0) {
                classesListElement.innerHTML = `
                    <li class="py-3 text-center text-gray-500">
                        Bạn chưa tham gia lớp học nào
                    </li>
                `;
            } else {
                classesListElement.innerHTML = '';
                
                for (const classId of userClassIds) {
                    console.log("Đang tải thông tin lớp học cho ID lớp:", classId);
                    const classDoc = await getDoc(doc(db, "classes", classId));
                    if (classDoc.exists()) {
                        const classData = classDoc.data();
                        const memberCount = await getMemberCount(classId);
                        
                        classesListElement.innerHTML += `
                            <li class="py-2">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <div class="font-medium">${classData.name}</div>
                                        <div class="text-xs text-gray-500">
                                            <i class="fas fa-users mr-1"></i>${memberCount} thành viên
                                        </div>
                                    </div>
                                    <a href="#" onclick="window.viewClass('${classId}')" class="text-blue-500 text-sm">
                                        <i class="fas fa-eye"></i>
                                    </a>
                                </div>
                            </li>
                        `;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi tải lớp học của người dùng:", error);
        const classesListElement = document.getElementById('userClassesList');
        if (classesListElement) {
            classesListElement.innerHTML = `
                <li class="py-3 text-center text-red-500">
                    Lỗi khi tải lớp học: ${error.message}
                </li>
            `;
        }
    }
}

window.addClass = addClass;
window.updateClass = updateClass;
window.deleteClass = deleteClass;
window.viewClass = viewClass;
window.joinClass = joinClass;
