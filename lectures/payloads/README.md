# Image payload sources

These gzip chunks are generated from the two lecture JSON files after embedding the original image-question slides. `tools/materialize_image_lectures.py` verifies each reconstructed file by SHA-256 before the normal build and validation steps run.
