param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$FilePath
)

$ErrorActionPreference = 'Stop'

$code = @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int SendBytesToPrinter(string szPrinterName, byte[] bytes)
    {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        int written;
        bool ok;

        di.pDocName = "Raw Label Print";
        di.pDataType = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero))
            throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
        try
        {
            if (!StartDocPrinter(hPrinter, 1, di))
                throw new Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
            try
            {
                if (!StartPagePrinter(hPrinter))
                    throw new Exception("StartPagePrinter failed: " + Marshal.GetLastWin32Error());

                IntPtr pUnmanagedBytes = Marshal.AllocHGlobal(bytes.Length);
                Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                ok = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                Marshal.FreeHGlobal(pUnmanagedBytes);

                if (!ok)
                    throw new Exception("WritePrinter failed: " + Marshal.GetLastWin32Error());

                EndPagePrinter(hPrinter);
            }
            finally
            {
                EndDocPrinter(hPrinter);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
        return written;
    }
}
'@

try {
    Add-Type -TypeDefinition $code -Language CSharp
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $written = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
    [PSCustomObject]@{ ok = $true; bytesSent = $bytes.Length; bytesWritten = $written } | ConvertTo-Json -Compress
}
catch {
    [PSCustomObject]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
