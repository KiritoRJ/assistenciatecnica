
<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
require_once 'db_config.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $t = $input['tenantData'];

    $stmt = $pdo->prepare("INSERT INTO tenants (id, storeName, adminUsername, adminPasswordHash, createdAt) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$t['id'], $t['storeName'], $t['adminUsername'], $t['adminPasswordHash'], $t['createdAt']]);
    echo json_encode(["success" => true]);
} else {
    $stmt = $pdo->query("SELECT * FROM tenants");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}
?>
