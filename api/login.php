
<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
require_once 'db_config.php';

$data = json_decode(file_get_contents("php://input"), true);
$username = $data['username'] ?? '';
$passwordHash = $data['passwordHash'] ?? '';

// Login Super Admin Wandev (Fixo)
if ($username === 'wandev' && $passwordHash === base64_encode('wan123')) {
    echo json_encode(["success" => true, "type" => "super"]);
    exit;
}

// Consulta no MySQL
$stmt = $pdo->prepare("SELECT * FROM tenants WHERE adminUsername = ?");
$stmt->execute([$username]);
$tenant = $stmt->fetch(PDO::FETCH_ASSOC);

if ($tenant && $tenant['adminPasswordHash'] === $passwordHash) {
    echo json_encode(["success" => true, "type" => "admin", "tenant" => $tenant]);
} else {
    echo json_encode(["success" => false, "message" => "Credenciais incorretas no servidor."]);
}
?>
