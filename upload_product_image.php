<?php
function updateProductImage($product_id, $image_path) {
    // Check if the image exists
    if (file_exists($image_path)) {
        // Read the image into binary data
        $image_data = file_get_contents($image_path);
        
        // Connect to the database
        $conn = mysqli_connect("localhost", "root", "Bills1234*", "products");

        if (!$conn) {
            die("Connection failed: " . mysqli_connect_error());
        }

        // Prepare the SQL query to update the ProductImage column
        $sql = "UPDATE products_for_sale SET ProductImage = ? WHERE idProduct = ?";

        // Use prepared statements to avoid SQL injection
        $stmt = $conn->prepare($sql);

        // Bind the binary image data and the product ID to the statement
        $stmt->bind_param("bi", $image_data, $product_id);

        // Execute the query
        if ($stmt->execute()) {
            echo "Image updated successfully for Product ID: $product_id.<br>";
        } else {
            echo "Error updating image: " . $stmt->error . "<br>";
        }

        // Close the statement and connection
        $stmt->close();
        $conn->close();
    } else {
        echo "Image file not found at $image_path.<br>";
    }
}

// Array of products with their image paths
$productImages = [
    ['idProduct' => 1, 'imagePath' => 'Main Images/productImages/chainsaw.png'],
    ['idProduct' => 2, 'imagePath' => 'Main Images/productImages/forklift.png'],
    ['idProduct' => 3, 'imagePath' => 'Main Images/productImages/hammer.jpg'],
    ['idProduct' => 4, 'imagePath' => 'Main Images/productImages/gloves.jpg'],
];

// Loop through each product and update the image in the database
foreach ($products as $product) {
    updateProductImage($product['idProduct'], $product['imagePath']);
}
?>