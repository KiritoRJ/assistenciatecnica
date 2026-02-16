
<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
require_once 'db_config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // SALVAR DADOS (PUSH)
    $input = json_decode(file_get_contents("php://input"), true);
    $tenantId = $input['tenantId'];
    $store = $input['store'];
    $data_json = json_encode($input['data']);

    $stmt = $pdo->prepare("INSERT INTO cloud_data (tenantId, storeKey, data_json) 
                           VALUES (?, ?, ?) 
                           ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)");
    $stmt->execute([$tenantId, $store, $data_json]);
    echo json_encode(["success" => true]);

} else if ($method === 'GET') {
    // BUSCAR DADOS (PULL)
    $tenantId = $_GET['tenantId'] ?? '';
    $store = $_GET['store'] ?? '';

    $stmt = $pdo->prepare("SELECT data_json FROM cloud_data WHERE tenantId = ? AND storeKey = ?");
    $stmt->execute([$tenantId, $store]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        echo $result['data_json']; // Já retorna o JSON puro
    } else {
        echo json_encode(null);
    }
}
?>
