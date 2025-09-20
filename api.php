<?php
// backend/api.php
header('Content-Type: application/json');
session_start(); // Start PHP session for authentication

require_once 'db.php'; // Include database connection

// Helper function to get JSON input
function get_json_input() {
    $input = file_get_contents('php://input');
    return json_decode($input, true);
}

// Helper function for sending JSON response
function send_response($success, $message, $data = []) {
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit();
}

// Helper function to get current user data from DB
function get_user_data_from_db($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT id, username, points, energy, max_energy, last_energy_update, join_date, tasks FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    return $stmt->fetch();
}

// Helper function to calculate energy refill
function calculate_energy_refill($lastEnergyUpdate, $currentEnergy, $maxEnergy, $energyRefillRate) {
    $now = time();
    $timeElapsed = $now - $lastEnergyUpdate;
    $energyToRefill = $timeElapsed * $energyRefillRate;
    return min($maxEnergy, $currentEnergy + $energyToRefill);
}

// Constants for game logic (MUST match frontend for consistency but server is authoritative)
define('API_MAX_ENERGY', 1000);
define('API_ENERGY_REFILL_RATE', 2);
define('API_POINTS_PER_TAP', 1);
define('API_ENERGY_PER_TAP', 1);
define('API_TASK_REWARD', 1000);
define('API_COIN_TO_INR_RATE', 0.001); // 10000 Coins = 10 INR

// --- API Endpoints ---
$action = $_GET['action'] ?? '';

if ($action === 'payment_success') {
    // Handle the payment logic here...

    // Send email to you
    $to = "ankurboro236@gmail.com";
    $subject = "Payment Received";
    $message = "A user has successfully made a payment on your site.";
    $headers = "From: no-reply@yourdomain.com";

    mail($to, $subject, $message, $headers);

    send_response(true, "Payment successful.");
}
$method = $_SERVER['REQUEST_METHOD'];
$input = get_json_input(); // For POST/PUT requests

// Non-authenticated actions
switch ($action) {
    case 'register':
        if ($method !== 'POST') { send_response(false, 'Invalid method.'); }
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) {
            send_response(false, 'Username and password are required.');
        }
        if (strlen($password) < 6) {
            send_response(false, 'Password must be at least 6 characters long.');
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $initialTasks = json_encode([
            ['id' => 0, 'completed' => false],
            ['id' => 1, 'completed' => false],
            ['id' => 2, 'completed' => false],
            ['id' => 3, 'completed' => false],
            ['id' => 4, 'completed' => false],
        ]);

        try {
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, points, energy, max_energy, last_energy_update, tasks) VALUES (?, ?, 0, ?, ?, UNIX_TIMESTAMP(), ?)");
            $stmt->execute([$username, $passwordHash, API_MAX_ENERGY, API_MAX_ENERGY, $initialTasks]);
            send_response(true, 'Registration successful. Please log in.');
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // Duplicate entry error code
                send_response(false, 'Username already exists. Please choose another.');
            } else {
                error_log("Registration error: " . $e->getMessage());
                send_response(false, 'An error occurred during registration. Please try again.');
            }
        }
        break;

    case 'login':
        if ($method !== 'POST') { send_response(false, 'Invalid method.'); }
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) {
            send_response(false, 'Username and password are required.');
        }

        $stmt = $pdo->prepare("SELECT id, username, password_hash, points, energy, max_energy, last_energy_update, join_date, tasks FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $user['energy'] = calculate_energy_refill($user['last_energy_update'], $user['energy'], $user['max_energy'], API_ENERGY_REFILL_RATE);
            $user['last_energy_update'] = time();
            
            $updateStmt = $pdo->prepare("UPDATE users SET energy = ?, last_energy_update = ? WHERE id = ?");
            $updateStmt->execute([$user['energy'], $user['last_energy_update'], $user['id']]);

            unset($user['password_hash']);
            send_response(true, 'Login successful!', ['user' => $user]);
        } else {
            send_response(false, 'Invalid username or password.');
        }
        break;

    case 'check_auth':
        if ($method !== 'GET') { send_response(false, 'Invalid method.'); }
        if (isset($_SESSION['user_id'])) {
            $user = get_user_data_from_db($pdo, $_SESSION['user_id']);
            if ($user) {
                $user['energy'] = calculate_energy_refill($user['last_energy_update'], $user['energy'], $user['max_energy'], API_ENERGY_REFILL_RATE);
                $user['last_energy_update'] = time();
                $updateStmt = $pdo->prepare("UPDATE users SET energy = ?, last_energy_update = ? WHERE id = ?");
                $updateStmt->execute([$user['energy'], $user['last_energy_update'], $user['id']]);

                send_response(true, 'Authenticated', ['user' => $user]);
            } else {
                session_unset();
                session_destroy();
                send_response(false, 'Session invalid.');
            }
        } else {
            send_response(false, 'Not authenticated.');
        }
        break;

    case 'logout':
        if ($method !== 'GET') { send_response(false, 'Invalid method.'); }
        session_unset();
        session_destroy();
        send_response(true, 'Logged out successfully.');
        break;

    default:
        if (!isset($_SESSION['user_id'])) {
            send_response(false, 'Authentication required.', ['code' => 'AUTH_REQUIRED']);
        }
        
        $userId = $_SESSION['user_id'];
        $user = get_user_data_from_db($pdo, $userId);

        if (!$user) {
            session_unset(); session_destroy();
            send_response(false, 'User not found or session invalid.', ['code' => 'USER_NOT_FOUND']);
        }

        $user['energy'] = calculate_energy_refill($user['last_energy_update'], $user['energy'], $user['max_energy'], API_ENERGY_REFILL_RATE);
        $user['last_energy_update'] = time();


        switch ($action) {
            case 'tap':
                if ($method !== 'POST') { send_response(false, 'Invalid method.'); }
                $pointsToAdd = $input['points'] ?? 0; // Should be API_POINTS_PER_TAP
                $energyCost = $input['energy_cost'] ?? 1; // Should be API_ENERGY_PER_TAP

                // Server-side verification for points/energy to prevent client manipulation
                if ($pointsToAdd != API_POINTS_PER_TAP || $energyCost != API_ENERGY_PER_TAP) {
                    send_response(false, 'Invalid tap parameters. Cheating attempt detected!', ['user' => $user]);
                }

                if ($user['energy'] < $energyCost) {
                    send_response(false, 'Not enough energy!', ['user' => $user]);
                }

                $user['points'] += $pointsToAdd;
                $user['energy'] -= $energyCost;
                
                $stmt = $pdo->prepare("UPDATE users SET points = ?, energy = ?, last_energy_update = ? WHERE id = ?");
                $stmt->execute([$user['points'], $user['energy'], $user['last_energy_update'], $userId]);
                send_response(true, 'Tap successful!', ['user' => $user]);
                break;

            case 'complete_task':
                if ($method !== 'POST') { send_response(false, 'Invalid method.'); }
                $taskId = $input['taskId'] ?? null;
                $reward = $input['reward'] ?? 0; // Should be API_TASK_REWARD

                // Server-side verification
                if ($reward != API_TASK_REWARD) {
                    send_response(false, 'Invalid task reward. Cheating attempt detected!');
                }

                if ($taskId === null || !is_numeric($taskId)) {
                    send_response(false, 'Invalid task ID.');
                }

                $tasks = json_decode($user['tasks'], true);
                if (!is_array($tasks)) $tasks = [];

                $taskIndex = -1;
                foreach ($tasks as $i => $t) {
                    if ($t['id'] == $taskId) {
                        $taskIndex = $i;
                        break;
                    }
                }

                if ($taskIndex === -1) {
                    send_response(false, 'Task not recognized or defined.');
                }
                
                if ($tasks[$taskIndex]['completed']) {
                    send_response(false, 'Task already completed.');
                }

                $tasks[$taskIndex]['completed'] = true;
                $user['points'] += $reward;
                $updatedTasksJson = json_encode($tasks);

                $stmt = $pdo->prepare("UPDATE users SET points = ?, tasks = ?, last_energy_update = ? WHERE id = ?");
                $stmt->execute([$user['points'], $updatedTasksJson, $user['last_energy_update'], $userId]);
                $user['tasks'] = $updatedTasksJson;
                send_response(true, 'Task completed and reward claimed!', ['user' => $user]);
                break;

            case 'request_withdrawal':
                if ($method !== 'POST') { send_response(false, 'Invalid method.'); }
                $amount = $input['amount'] ?? 0;
                $method = $input['method'] ?? '';
                $details = $input; // Store all input details

                // Server-side minimum withdrawal validation (10000 coins)
                $minWithdrawalCoins = 10000;
                if ($amount < $minWithdrawalCoins) {
                    send_response(false, 'Minimum withdrawal amount is ' . number_format($minWithdrawalCoins) . ' coins (10 INR).');
                }

                if ($amount <= 0 || $amount > $user['points']) {
                    send_response(false, 'Invalid withdrawal amount or insufficient points.');
                }
                
                // Server-side validation of specific fields based on method
                if ($method === 'paypal' && (empty($details['email']) || !filter_var($details['email'], FILTER_VALIDATE_EMAIL))) {
                    send_response(false, 'Invalid PayPal email.');
                } elseif ($method === 'wire' && (empty($details['account']) || empty($details['routing']))) {
                    send_response(false, 'Bank account and routing numbers are required.');
                } elseif ($method === 'crypto' && (empty($details['address']) || strlen($details['address']) < 26 || !str_starts_with($details['address'], 'T'))) {
                    send_response(false, 'Invalid USDT Wallet Address.');
                } elseif ($method === 'upi' && (empty($details['upiId']) || !preg_match('/^[a-zA-Z0-9.\-]+@[a-zA-Z0-9.\-]+$/', $details['upiId']))) { // Basic UPI regex
                    send_response(false, 'Invalid UPI ID format. E.g., user@bankname');
                }


                $user['points'] -= $amount;

                try {
                    $pdo->beginTransaction();
                    
                    $stmt = $pdo->prepare("UPDATE users SET points = ?, last_energy_update = ? WHERE id = ?");
                    $stmt->execute([$user['points'], $user['energy'], $user['last_energy_update'], $userId]); // Updated energy needs to be saved here too
                    
                    $stmt = $pdo->prepare("INSERT INTO withdrawals (user_id, amount, method, details) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$userId, $amount, $method, json_encode($details)]);
                    
                    $pdo->commit();
                    send_response(true, 'Withdrawal request submitted successfully! It will be reviewed soon.', ['user' => $user]);

                } catch (PDOException $e) {
                    $pdo->rollBack();
                    error_log("Withdrawal error: " . $e->getMessage());
                    send_response(false, 'An error occurred during withdrawal. Please try again.');
                }
                break;

            default:
                send_response(false, 'Invalid action.');
        }
        break;
}

send_response(false, 'Invalid API request.');
?>