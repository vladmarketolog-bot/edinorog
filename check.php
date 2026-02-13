<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h1>System Check</h1>";
echo "PHP Version: " . phpversion() . "<br>";

echo "<hr>";
echo "<h3>1. Checking RSSFetcher.php Syntax</h3>";
try {
    if (!file_exists('php/RSSFetcher.php')) {
        throw new Exception("File php/RSSFetcher.php caused an error!");
    }
    require_once 'php/RSSFetcher.php';
    echo "<font color='green'>RSSFetcher.php is OK (Syntax Valid).</font><br>";
    
    $fetcher = new RSSFetcher();
    echo "RSSFetcher class instantiated successfully.<br>";
} catch (Throwable $e) {
    echo "<font color='red'>CRITICAL ERROR in RSSFetcher.php: " . $e->getMessage() . "</font><br>";
    echo "Line: " . $e->getLine() . "<br>";
}

echo "<hr>";
echo "<h3>2. Checking proxy.php existence</h3>";
if (file_exists('proxy.php')) {
    echo "<font color='green'>proxy.php found.</font><br>";
} else {
    echo "<font color='red'>proxy.php NOT FOUND.</font><br>";
}

echo "<hr>";
echo "<h3>Server Environment</h3>";
echo "Server Software: " . $_SERVER['SERVER_SOFTWARE'] . "<br>";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "<br>";
?>
