
<?php
// CONFIGURAÇÕES DO SEU BANCO DE DADOS (Preencha com os dados da sua hospedagem)
$host = 'localhost';
$db   = 'assistencia_pro';
$user = 'seu_usuario';
$pass = 'sua_senha';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Erro ao conectar: " . $e.getMessage());
}

// Criar tabelas automaticamente se não existirem
$pdo->exec("CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(50) PRIMARY KEY,
    storeName VARCHAR(100),
    adminUsername VARCHAR(50) UNIQUE,
    adminPasswordHash TEXT,
    createdAt DATETIME
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS cloud_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId VARCHAR(50),
    storeKey VARCHAR(50),
    data_json LONGTEXT,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY tenant_store (tenantId, storeKey)
)");
?>
