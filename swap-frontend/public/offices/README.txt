Per-office logos
================

Drop a PNG here named after the office CODE (lowercase) to replace the
placeholder monogram shown on the Admin → Offices cards.

  Filename convention:  /public/offices/{code}.png

Examples:
  Office code "LIB"  ->  public/offices/lib.png   (University Library)
  Office code "REG"  ->  public/offices/reg.png   (Office of the Registrar)
  Office code "ITC"  ->  public/offices/itc.png   (IT Center)

Notes:
- The code is matched case-insensitively (REG, reg, Reg all map to reg.png).
- Recommended: square image, transparent background, ~128x128px or larger.
- If no file exists for an office's code, a tinted building icon is shown
  automatically — no error, nothing breaks.
- These are static files served by Next.js, so they persist across deploys
  (unlike user-uploaded files). Just commit them with the repo before deploy.
