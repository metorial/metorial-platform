import java.io.InputStream;
import java.util.Enumeration;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class ZipCheck {
    public static void main(String[] args) throws Exception {
        long entries = 0;
        long totalSize = 0;
        byte[] buffer = new byte[1 << 16];

        try (ZipFile zip = new ZipFile(args[0])) {
            Enumeration<? extends ZipEntry> all = zip.entries();
            while (all.hasMoreElements()) {
                ZipEntry entry = all.nextElement();
                CRC32 crc = new CRC32();
                long size = 0;

                try (InputStream in = zip.getInputStream(entry)) {
                    int read;
                    while ((read = in.read(buffer)) > 0) {
                        crc.update(buffer, 0, read);
                        size += read;
                    }
                }

                if (crc.getValue() != entry.getCrc() || size != entry.getSize()) {
                    throw new IllegalStateException("mismatch in " + entry.getName());
                }

                entries++;
                totalSize += size;
            }
        }

        System.out.println("entries=" + entries + " bytes=" + totalSize);
    }
}
