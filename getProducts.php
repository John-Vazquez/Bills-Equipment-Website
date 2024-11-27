<?php



function fetchProducts() {
    $output = [];

    $conn = mysqli_connect("localhost", "root", "Bills1234*", "products");

    // Write query for all products
    $sql = "SELECT * FROM products_for_sale"; // Ensure to end the statement with a semicolon
    // Make query and get result
    $result = $conn->query($sql); // Correct the function call

    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            // Concatenate each row's data to the output variable
            $output []= $row;
        }
    }

    return $output; 

    // Close the connection to the database
    $conn->close();
}
    
?>