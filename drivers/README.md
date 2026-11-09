# 4BARCODE Windows driver

`4barcode/windows-x64/` contains the vendor driver package copied from this
computer's Windows Driver Store for the 4BARCODE 4B-2034PA printer.

- Provider: 4BARCODE
- Version: 2024.11.14.1 (November 14, 2024)
- Included architecture: Windows x64
- Installation information: `4barcode/windows-x64/4bprtv6.inf`

Keep the INF, CAT, `amd64`, and `dat` files together. The Windows-generated PNF
cache is omitted. Although the INF lists other architectures, this copy only
contains x64 binaries. These are vendor files, not application source code.

To configure another Windows x64 computer, download or clone the repository,
then use Windows' Add Printer driver selection and choose **Have Disk**,
browsing to `4bprtv6.inf`. Select **4BARCODE 4B-2034PA** and the port assigned
to the connected printer. Administrator access may be required.

The application uses the printer queue configured in Windows; it does not
automatically install this package. Installation on another computer has not
been tested.
