<?php
header('Content-Type: application/json');
session_start();

$conn = new mysqli("localhost", "root", "", "trae");

if ($conn->connect_error) {
    die(json_encode(['error' => 'Connection failed']));
}

$action = $_POST['action'] ?? '';

switch($action) {
    case 'login':
        $username = $conn->real_escape_string($_POST['username']);
        $password = $_POST['password'];
        
        $result = $conn->query("SELECT * FROM users WHERE username = '$username'");
        if($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            if(password_verify($password, $user['password'])) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['error' => 'Invalid password']);
            }
        } else {
            echo json_encode(['error' => 'User not found']);
        }
        break;

    case 'register':
        $username = $conn->real_escape_string($_POST['username']);
        $password = password_hash($_POST['password'], PASSWORD_DEFAULT);
        
        try {
            $conn->query("INSERT INTO users (username, password) VALUES ('$username', '$password')");
            echo json_encode(['success' => true]);
        } catch(Exception $e) {
            echo json_encode(['error' => 'Username already exists']);
        }
        break;
// Add this case to your switch statement
    case 'check_auth':
        if(isset($_SESSION['user_id'])) {
            echo json_encode([
                'authenticated' => true,
                'username' => $_SESSION['username']
            ]);
        } else {
            echo json_encode(['authenticated' => false]);
        }
        break;
    case 'send':
        if(!isset($_SESSION['user_id'])) {
            echo json_encode(['error' => 'Not logged in']);
            break;
        }
        
        $message = $conn->real_escape_string($_POST['message']);
        $sender_id = $_SESSION['user_id'];
        $group_id = (int)$_POST['group_id'];
        
        $conn->query("INSERT INTO group_messages (group_id, sender_id, message) VALUES ($group_id, $sender_id, '$message')");
        echo json_encode(['success' => true]);
        break;
// Add these new cases to your switch statement
    case 'create_group':
        if(!isset($_SESSION['user_id'])) {
            echo json_encode(['error' => 'Not logged in']);
            break;
        }
        
        $name = $conn->real_escape_string($_POST['name']);
        $pin = sprintf("%06d", mt_rand(0, 999999)); // Generate 6-digit PIN
        $user_id = $_SESSION['user_id'];
        
        $conn->begin_transaction();
        try {
            $conn->query("INSERT INTO groups (name, pin, created_by) VALUES ('$name', '$pin', $user_id)");
            $group_id = $conn->insert_id;
            $conn->query("INSERT INTO group_members (group_id, user_id) VALUES ($group_id, $user_id)");
            $conn->commit();
            echo json_encode(['success' => true, 'pin' => $pin]);
        } catch(Exception $e) {
            $conn->rollback();
            echo json_encode(['error' => 'Failed to create group']);
        }
        break;

    case 'join_group':
        if(!isset($_SESSION['user_id'])) {
            echo json_encode(['error' => 'Not logged in']);
            break;
        }
        
        $pin = $conn->real_escape_string($_POST['pin']);
        $user_id = $_SESSION['user_id'];
        
        $result = $conn->query("SELECT id FROM groups WHERE pin = '$pin'");
        if($result->num_rows > 0) {
            $group = $result->fetch_assoc();
            try {
                $conn->query("INSERT INTO group_members (group_id, user_id) VALUES ({$group['id']}, $user_id)");
                echo json_encode(['success' => true]);
            } catch(Exception $e) {
                echo json_encode(['error' => 'Already a member']);
            }
        } else {
            echo json_encode(['error' => 'Invalid PIN']);
        }
        break;

    case 'get_groups':
        if(!isset($_SESSION['user_id'])) {
            echo json_encode(['error' => 'Not logged in']);
            break;
        }
        
        $user_id = $_SESSION['user_id'];
        $result = $conn->query("SELECT g.* FROM groups g 
                              JOIN group_members gm ON g.id = gm.group_id 
                              WHERE gm.user_id = $user_id");
        $groups = [];
        while($row = $result->fetch_assoc()) {
            $groups[] = $row;
        }
        echo json_encode(['groups' => $groups]);
        break;

    case 'get_group_messages':
        if(!isset($_SESSION['user_id'])) {
            echo json_encode(['error' => 'Not logged in']);
            break;
        }
        
        $group_id = (int)$_POST['group_id'];
        $result = $conn->query("SELECT gm.*, u.username 
                              FROM group_messages gm 
                              JOIN users u ON gm.sender_id = u.id 
                              WHERE gm.group_id = $group_id 
                              ORDER BY gm.created_at DESC LIMIT 50");
        $messages = [];
        while($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }
        echo json_encode(['messages' => array_reverse($messages)]);
        break;
}

$conn->close();
?>