// OpenSCAD extrusion template for the traced logo SVG.
// Steps:
// 1) Vectorize your PNG to an SVG called "logo.svg" next to this file (see commands below).
// 2) Optionally edit the scale/height values below.
// 3) Export STL with: `openscad -o logo.stl logo_extrude.scad`

// Adjust these parameters as needed
logo_svg = "logo.svg"; // path to traced SVG
extrude_height = 6; // mm
scale_factor = 1.0; // overall scale

// Import and extrude the 2D path
scale([scale_factor, scale_factor, 1])
    linear_extrude(height = extrude_height, center = true, convexity = 10)
        import(file = logo_svg, center = true);
