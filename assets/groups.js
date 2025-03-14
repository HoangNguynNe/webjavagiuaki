// groups.js - Quản lý nhóm
import { db, auth } from "./firebase.js";
import { 
    collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where, getCountFromServer, getDoc, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    setupMenuToggle, isAdminOrTeacher, waitForAuth, showLoading, showError, showEmpty, 
    getClassName, isClassMember, getUserClasses 
} from "./utils.js";

// Khởi tạo chức năng menu
setupMenuToggle();

// Thêm nhóm mới
async function addGroup() {
    const groupName = document.getElementById("groupName").value;
    const classId = document.getElementById("classId").value;
    const description = document.getElementById("groupDescription").value;

    if (!groupName || !classId) {
        alert("Vui lòng nhập tên nhóm và chọn lớp học");
        return;
    }

    try {
        await addDoc(collection(db, "groups"), { 
            name: groupName, 
            classId,
            description: description || "",
            createdAt: new Date().toISOString()
        });
        alert("Nhóm mới đã được tạo!");
        document.getElementById("groupName").value = "";
        document.getElementById("groupDescription").value = "";
        loadGroups();
    } catch (error) {
        console.error("Lỗi khi thêm nhóm:", error);
        alert("Không thể tạo nhóm. Vui lòng thử lại.");
    }
}

// Xóa nhóm
async function deleteGroup(groupId) {
    if (!confirm("Bạn có chắc muốn xóa nhóm này?")) return;
    
    try {
        await deleteDoc(doc(db, "groups", groupId));
        alert("Nhóm đã bị xóa!");
        loadGroups();
    } catch (error) {
        console.error("Lỗi khi xóa nhóm:", error);
        alert("Không thể xóa nhóm. Vui lòng thử lại.");
    }
}

// Cập nhật nhóm
async function updateGroup(groupId) {
    try {
        // Lấy thông tin nhóm
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (!groupDoc.exists()) {
            alert("Không tìm thấy nhóm!");
            return;
        }
        
        const groupData = groupDoc.data();
        
        // Điền thông tin vào modal
        document.getElementById("updateGroupId").value = groupId;
        document.getElementById("updateGroupName").value = groupData.name || "";
        document.getElementById("updateGroupDescription").value = groupData.description || "";
        
        // Hiển thị modal
        document.getElementById("updateGroupModal").classList.remove("hidden");
    } catch (error) {
        console.error("Lỗi khi lấy thông tin nhóm:", error);
        alert("Không thể cập nhật nhóm. Vui lòng thử lại.");
    }
}

// Lưu thông tin nhóm đã cập nhật
async function saveUpdatedGroup() {
    const groupId = document.getElementById("updateGroupId").value;
    const groupName = document.getElementById("updateGroupName").value;
    const groupDescription = document.getElementById("updateGroupDescription").value;
    
    if (!groupName) {
        alert("Vui lòng nhập tên nhóm");
        return;
    }
    
    try {
        await updateDoc(doc(db, "groups", groupId), {
            name: groupName,
            description: groupDescription,
            updatedAt: new Date().toISOString()
        });
        
        // Ẩn modal
        document.getElementById("updateGroupModal").classList.add("hidden");
        
        alert("Cập nhật nhóm thành công!");
        loadGroups();
    } catch (error) {
        console.error("Lỗi khi cập nhật nhóm:", error);
        alert("Không thể cập nhật nhóm. Vui lòng thử lại.");
    }
}

// Lấy số lượng thành viên của nhóm
async function getMemberCount(groupId) {
    try {
        const memberQuery = query(
            collection(db, "users"), 
            where("groupIds", "array-contains", groupId)
        );
        
        const snapshot = await getCountFromServer(memberQuery);
        return snapshot.data().count;
    } catch (error) {
        console.error("Lỗi khi đếm thành viên nhóm:", error);
        return 0;
    }
}

// Tải dropdown lớp học
async function loadClassDropdown() {
    const classSelect = document.getElementById("classId");
    const classFilter = document.getElementById("classFilter");
    
    try {
        const querySnapshot = await getDocs(collection(db, "classes"));
        
        if (classSelect) {
            classSelect.innerHTML = '<option value="">-- Chọn lớp học --</option>';
            querySnapshot.forEach((docSnap) => {
                const classData = docSnap.data();
                classSelect.innerHTML += `<option value="${docSnap.id}">${classData.name}</option>`;
            });
        }
        
        if (classFilter) {
            classFilter.innerHTML = '<option value="">Tất cả lớp học</option>';
            querySnapshot.forEach((docSnap) => {
                const classData = docSnap.data();
                classFilter.innerHTML += `<option value="${docSnap.id}">${classData.name}</option>`;
            });
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
    }
}

// Hiển thị danh sách nhóm
async function loadGroups() {
    const groupList = document.getElementById("groupList");
    if (!groupList) return;
    
    showLoading(groupList, "Đang tải danh sách nhóm...");

    try {
        // Đảm bảo đã xác thực
        const user = await waitForAuth();
        if (!user) {
            showError(groupList, "Bạn cần đăng nhập để xem nhóm");
            return;
        }
        
        console.log("Đang tải nhóm cho người dùng:", user.email);
        
        const isAdmin = await isAdminOrTeacher();
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();
        const userClassIds = userData.classIds || [];
        
        // Với người dùng thường, kiểm tra nếu họ đã đăng nhập và có lớp học
        if (!isAdmin && userClassIds.length === 0) {
            showEmpty(groupList, "Bạn chưa tham gia lớp học nào. Hãy tham gia một lớp học trước!");
            return;
        }
        
        const classFilter = document.getElementById("classFilter")?.value;
        const searchTerm = document.getElementById("groupSearch")?.value?.toLowerCase() || '';
        
        let groupsQuery;
        
        if (classFilter) {
            // Nếu lọc theo một lớp cụ thể
            groupsQuery = query(collection(db, "groups"), where("classId", "==", classFilter));
        } else if (!isAdmin) {
            // Với người dùng thường không có bộ lọc, chỉ hiển thị nhóm từ các lớp của họ
            if (userClassIds.length === 1) {
                // Nếu người dùng chỉ trong một lớp, truy vấn trực tiếp bằng lớp đó
                groupsQuery = query(collection(db, "groups"), where("classId", "==", userClassIds[0]));
            } else {
                // Người dùng trong nhiều lớp, cần lọc sau khi lấy tất cả
                groupsQuery = collection(db, "groups");
            }
        } else {
            // Admin thấy tất cả nhóm
            groupsQuery = collection(db, "groups");
        }
        
        const querySnapshot = await getDocs(groupsQuery);
        
        if (querySnapshot.empty) {
            showEmpty(groupList, "Chưa có nhóm nào trong lớp học này.");
            return;
        }
        
        const groups = [];
        
        for (const docSnap of querySnapshot.docs) {
            const groupData = docSnap.data();
            
            // Với không phải admin: nếu đã lấy tất cả nhóm, lọc để chỉ bao gồm nhóm từ các lớp của người dùng
            if (!isAdmin && !classFilter && !userClassIds.includes(groupData.classId)) {
                continue;
            }
            
            const className = await getClassName(groupData.classId);
            const memberCount = await getMemberCount(docSnap.id);
            const isMember = await isGroupMember(docSnap.id);
            
            groups.push({
                id: docSnap.id,
                ...groupData,
                className,
                memberCount,
                isMember
            });
        }
        
        // Lọc theo từ khóa tìm kiếm nếu có
        const filteredGroups = searchTerm ? 
            groups.filter(group => group.name.toLowerCase().includes(searchTerm)) :
            groups;
            
        if (filteredGroups.length === 0) {
            showEmpty(groupList, `Không tìm thấy nhóm nào phù hợp${searchTerm ? ` với từ khóa "${searchTerm}"` : ''}`);
            return;
        }
            
        groupList.innerHTML = "";
        
        // Sắp xếp nhóm theo ngày tạo (mới nhất đầu tiên)
        filteredGroups.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        filteredGroups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition';
            groupCard.innerHTML = `
                <div class="bg-green-500 text-white p-4">
                    <h3 class="text-xl font-bold">${group.name}</h3>
                </div>
                <div class="p-4">
                    <div class="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded mb-3 inline-block">
                        ${group.className}
                    </div>
                    <p class="text-gray-600 mb-4 h-12 overflow-hidden">
                        ${group.description || 'Không có mô tả'}
                    </p>
                    <div class="flex items-center text-sm text-gray-500 mb-4">
                        <i class="fas fa-users mr-2"></i>
                        <span>${group.memberCount} thành viên</span>
                    </div>
                    <div class="flex justify-between">
                        ${isAdmin || group.isMember ? 
                            `<button onclick="window.viewGroup('${group.id}')" class="px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                <i class="fas fa-eye mr-1"></i>Xem
                            </button>` :
                            `<button onclick="window.joinGroup('${group.id}')" class="px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                <i class="fas fa-sign-in-alt mr-1"></i>Tham gia
                            </button>`
                        }
                        ${isAdmin ? `
                        <div>
                            <button onclick="window.updateGroup('${group.id}')" class="px-3 py-1 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="window.deleteGroup('${group.id}')" class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            groupList.appendChild(groupCard);
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách nhóm:", error);
        showError(groupList, `Lỗi khi tải dữ liệu! ${error.message}`);
    }
}

// Xem chi tiết nhóm
async function viewGroup(groupId) {
    try {
        // Lấy thông tin nhóm
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (!groupDoc.exists()) {
            alert("Không tìm thấy nhóm!");
            return;
        }
        
        const groupData = groupDoc.data();
        
        // Lấy tên lớp
        const className = await getClassName(groupData.classId) || "Không thuộc lớp học nào";
        
        // Điền thông tin vào modal
        document.getElementById("viewGroupName").textContent = groupData.name || "Không có tên";
        document.getElementById("viewGroupClass").textContent = className;
        document.getElementById("viewGroupDescription").textContent = groupData.description || "Không có mô tả";
        
        // Tải danh sách thành viên trong nhóm
        const groupMembers = document.getElementById("groupMembers");
        groupMembers.innerHTML = "<tr><td colspan='3' class='text-center py-4'>Đang tải danh sách thành viên...</td></tr>";
        
        const membersQuery = query(
            collection(db, "users"),
            where("groupIds", "array-contains", groupId)
        );
        
        const querySnapshot = await getDocs(membersQuery);
        
        if (querySnapshot.empty) {
            groupMembers.innerHTML = "<tr><td colspan='3' class='text-center py-4'>Chưa có thành viên nào trong nhóm này</td></tr>";
        } else {
            groupMembers.innerHTML = "";
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
                groupMembers.innerHTML += row;
            });
        }
        
        // Hiển thị modal
        document.getElementById("viewGroupModal").classList.remove("hidden");
        
    } catch (error) {
        console.error("Lỗi khi xem chi tiết nhóm:", error);
        alert("Không thể xem chi tiết nhóm. Vui lòng thử lại.");
    }
}

// Kiểm tra người dùng có phải là thành viên của nhóm
async function isGroupMember(groupId) {
    const user = auth.currentUser;
    if (!user) return false;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return false;
        
        const userData = userDoc.data();
        return userData.groupIds && userData.groupIds.includes(groupId);
    } catch (error) {
        console.error("Lỗi khi kiểm tra tư cách thành viên nhóm:", error);
        return false;
    }
}

// Tham gia nhóm với kiểm tra một nhóm mỗi lớp
async function joinGroup(groupId) {
    const user = auth.currentUser;
    if (!user) {
        alert("Bạn cần đăng nhập để tham gia nhóm!");
        return;
    }
    
    try {
        // Kiểm tra nếu người dùng đang trong lớp học chứa nhóm này
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (!groupDoc.exists()) {
            alert("Không tìm thấy thông tin nhóm!");
            return;
        }
        
        const classId = groupDoc.data().classId;
        const isMemberOfClass = await isClassMember(classId);
        
        if (!isMemberOfClass) {
            alert("Bạn cần tham gia lớp học trước khi tham gia nhóm!");
            return;
        }
        
        // Kiểm tra nếu người dùng đã trong một nhóm khác từ cùng lớp học
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();
        const userGroups = userData.groupIds || [];
        
        if (userGroups.length > 0) {
            // Lấy tất cả nhóm mà người dùng là thành viên
            for (const existingGroupId of userGroups) {
                const existingGroupDoc = await getDoc(doc(db, "groups", existingGroupId));
                if (existingGroupDoc.exists() && existingGroupDoc.data().classId === classId) {
                    alert("Bạn đã tham gia một nhóm khác trong lớp học này. Mỗi thành viên chỉ được tham gia một nhóm trong mỗi lớp.");
                    return;
                }
            }
        }
        
        // Thêm nhóm vào danh sách nhóm của người dùng
        await updateDoc(doc(db, "users", user.uid), {
            groupIds: arrayUnion(groupId),
            updatedAt: new Date().toISOString()
        });
        
        alert("Tham gia nhóm thành công!");
        loadGroups(); // Cập nhật lại danh sách để cập nhật nút
    } catch (error) {
        console.error("Lỗi khi tham gia nhóm:", error);
        alert("Không thể tham gia nhóm. Vui lòng thử lại.");
    }
}

// Tải lớp học và nhóm của người dùng cho sidebar
async function loadUserClassesAndGroups() {
    const user = await waitForAuth();
    if (!user) {
        console.log("Không tìm thấy người dùng trong loadUserClassesAndGroups");
        return;
    }
    
    console.log("Đang tải lớp học và nhóm cho người dùng:", user.email);
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            console.log("Không tìm thấy tài liệu người dùng");
            return;
        }
        
        const userData = userDoc.data();
        const userClassIds = userData.classIds || [];
        const userGroupIds = userData.groupIds || [];
        
        console.log("ID lớp học của người dùng:", userClassIds);
        console.log("ID nhóm của người dùng:", userGroupIds);
        
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
                    const classDoc = await getDoc(doc(db, "classes", classId));
                    if (classDoc.exists()) {
                        const classData = classDoc.data();
                        classesListElement.innerHTML += `
                            <li class="py-2">
                                <div class="flex justify-between items-center">
                                    <span>${classData.name}</span>
                                    <a href="#" onclick="document.getElementById('classFilter').value='${classId}'; window.loadGroups(); return false;" 
                                       class="text-blue-500 text-sm">Xem nhóm</a>
                                </div>
                            </li>
                        `;
                    }
                }
            }
        }
        
        // Tải nhóm
        const groupsListElement = document.getElementById('userGroupsList');
        if (groupsListElement) {
            if (userGroupIds.length === 0) {
                groupsListElement.innerHTML = `
                    <li class="py-3 text-center text-gray-500">
                        Bạn chưa tham gia nhóm nào
                    </li>
                `;
            } else {
                groupsListElement.innerHTML = '';
                
                for (const groupId of userGroupIds) {
                    const groupDoc = await getDoc(doc(db, "groups", groupId));
                    if (groupDoc.exists()) {
                        const groupData = groupDoc.data();
                        const className = await getClassName(groupData.classId);
                        
                        groupsListElement.innerHTML += `
                            <li class="py-2">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <div>${groupData.name}</div>
                                        <div class="text-xs text-blue-500">${className}</div>
                                    </div>
                                    <a href="#" onclick="window.viewGroup('${groupId}')" class="text-blue-500 text-sm">
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
        console.error("Lỗi khi tải lớp học và nhóm của người dùng:", error);
        const classesListElement = document.getElementById('userClassesList');
        const groupsListElement = document.getElementById('userGroupsList');
        
        if (classesListElement) {
            classesListElement.innerHTML = `
                <li class="py-3 text-center text-red-500">
                    Lỗi: ${error.message}
                </li>
            `;
        }
        
        if (groupsListElement) {
            groupsListElement.innerHTML = `
                <li class="py-3 text-center text-red-500">
                    Lỗi: ${error.message}
                </li>
            `;
        }
    }
}

// Xuất các hàm cho sử dụng toàn cục
window.addGroup = addGroup;
window.deleteGroup = deleteGroup;
window.updateGroup = updateGroup;
window.viewGroup = viewGroup;
window.joinGroup = joinGroup;
window.loadGroups = loadGroups;

// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Đảm bảo xác thực đã sẵn sàng
        const user = await waitForAuth();
        
        if (!user) {
            console.log("Chưa có người dùng đăng nhập");
            return;
        }
        
        console.log("Người dùng đã đăng nhập:", user.email);
        
        // Khởi tạo với vai trò người dùng
        const isAdmin = await isAdminOrTeacher();
        
        // Hiển thị/ẩn form tạo nhóm dựa vào vai trò người dùng
        const createGroupSection = document.querySelector('.lg\\:col-span-1');
        if (createGroupSection) {
            if (!isAdmin) {
                // Với thành viên thường, thay thế bằng "Lớp học của tôi" và "Nhóm của tôi"
                createGroupSection.innerHTML = `
                    <div class="bg-white p-4 rounded-lg shadow-md mb-6">
                        <h3 class="text-lg font-semibold mb-4">Lớp học của tôi</h3>
                        <ul id="userClassesList" class="divide-y">
                            <li class="py-3 text-center text-gray-500">
                                <i class="fas fa-spinner fa-spin mr-2"></i> Đang tải...
                            </li>
                        </ul>
                    </div>
                    
                    <div class="bg-white p-4 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold mb-4">Nhóm của tôi</h3>
                        <ul id="userGroupsList" class="divide-y">
                            <li class="py-3 text-center text-gray-500">
                                <i class="fas fa-spinner fa-spin mr-2"></i> Đang tải...
                            </li>
                        </ul>
                    </div>
                `;
                
                // Tải lớp học và nhóm của người dùng
                loadUserClassesAndGroups();
            }
        }
        
        // Tiếp tục khởi tạo hiện tại
        loadClassDropdown();
        loadGroups();
        
        if (isAdmin) {
            document.getElementById("addGroupBtn")?.addEventListener("click", addGroup);
        }
        
        document.getElementById("classFilter")?.addEventListener("change", loadGroups);
        
        // Thêm chức năng tìm kiếm
        document.getElementById("searchBtn")?.addEventListener("click", loadGroups);
        document.getElementById("groupSearch")?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") loadGroups();
        });
        
        // Xử lý sự kiện modal cập nhật
        document.getElementById("cancelUpdateGroup")?.addEventListener("click", () => {
            document.getElementById("updateGroupModal").classList.add("hidden");
        });
        
        document.getElementById("confirmUpdateGroup")?.addEventListener("click", saveUpdatedGroup);
        
        // Xử lý sự kiện modal xem
        document.getElementById("closeViewGroupModal")?.addEventListener("click", () => {
            document.getElementById("viewGroupModal").classList.add("hidden");
        });
        
        document.getElementById("closeViewGroupBtn")?.addEventListener("click", () => {
            document.getElementById("viewGroupModal").classList.add("hidden");
        });
    } catch (error) {
        console.error("Lỗi khởi tạo trang nhóm:", error);
    }
});
