<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bills Equipment</title>
    <link rel="stylesheet" href="styles.css">

    <!-- START OF LINKS FOR GOOGLE FONT (MONTSERRAT BOLD700)--> 
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap" rel="stylesheet">
    <!-- END OF LINKS FOR GOOGLE FONT (MONTSERRAT BOLD700)-->

</head>
<!-- <body id = "products"> -->
<body>
<?php
// Include the PHP script that connects to the database and retrieves data
include 'getProducts.php';
?>
    <header class = "title">
        <a href="index.html"><img src = "Main Images/BE Logo.png" alt = "Error Loading Logo" class = "logo"></a>
        

        <nav> <!-- MAIN NAVIATION BAR-->
            <ul>
                <li><a href="index.html">Home</a></li>
            <li><a href="about.html">About</a></li>
            <li><a href="services.html">Services</a></li>
            <li><a href="products.html">Products</a></li>
            <li><a href="rentals.html">Rentals</a></li>
            <li><a href="contact.html">Contact</a></li>

            </ul>
        </nav>
        <h1> Products </h1>
    </header>
</body>
    
<div class="content-wrapper">
    <div class="filters-and-products">
        <aside class="filters">
            <h3>Keywords</h3>
                <div class="tag">
                    Machinery <span class="close">&times;</span>
                </div>
                <div class="tag">
                    Electric <span class="close">&times;</span>
                </div>
                <div class="tag">
                    Generators <span class="close">&times;</span>
                </div>
            
            <h4>Brand</h4>
                <label><input type="checkbox" checked> Brand </label><br>
                <p> Multiquip </p>
                <label><input type="checkbox" checked> Portable</label><br>
                <p> Wheels or fold-up</p>
                <label><input type="checkbox" checked> Label </label><br>
                <p> Description </p>

            <h4>Price</h4> 
            <input type="range" min="0" max="900" value="0"><br>
            <h4> Color </h4>
                <label id="color"><input type="checkbox" checked> Label </label><br>
                <label><input type="checkbox"> Label </label><br>
                <label><input type="checkbox"> Label </label><br>
            <h4> Size </h4>
                <label><input type="checkbox" checked> Heavy Duty</label><br>
                <label><input type="checkbox"> Regular</label><br>
                <label><input type="checkbox"> Small project</label><br>
            </aside>
            
            <div class= "search">
                <input type="text" id="search-input" placeholder="Search"/>
                <button type = "submit" class = "search button">
                    <img src = "Main Images/search.png" alt = "Error Loading Search" class = "search">
                </button>
            </div>
            <div class="flex-container">
                <button class="toggle-button" onclick="buttonClicked(this)"> Relevant </button>
                <button class="toggle-button" onclick="buttonClicked(this)"> Price ascending </button>
                <button class="toggle-button" onclick="buttonClicked(this)"> Price descending </button>
                <button class="toggle-button" onclick="buttonClicked(this)"> Rating </button>
            </div>
    </div>
    <div class="items-container-wrapper">
        
            <?php
                $products = fetchProducts();
                // Check if there are products
                if (!empty($products)) 
                {
                    foreach ($products as $product) 
                    {
                        // Display each product in a structured format
                        ?>

                        <a href="rentalDesc.html">
                            <div class="items-container">
                                <<h1><?php echo htmlspecialchars($product['ProductName']); ?></h1>
                                <img src="<?php echo htmlspecialchars($product['ProductImage']); ?>" alt="Product Image" id="product-image">
                                <p>PRICE: <?php echo $product["ProductPrice"]; ?></p>
                                <p><?php echo htmlspecialchars($product['ProductDescription']); ?></p>
                            </div>
                        </a>
                        <?php
                    }
                } else 
                {
                    // If no products found
                    echo "<p>No products available.</p>";
                }
            ?>
        </div>
    </div>

					<!-- Larger Product Items Section -->
					<div class="bigItems-container-wrapper">
						<!-- Links to product detail pages for larger items -->
						<a href="rentalDesc.html"><div class="bigItems-container"></div></a>
						<a href="rentalDesc.html"><div class="bigItems-container"></div></a>
						<a href="rentalDesc.html"><div class="bigItems-container"></div></a>
					</div>
				</div>
			</div>
		</div>
	</body>
</html>
