import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import * as store from './firebaseStore';

export async function exportMonthToPDF(monthStr: string) {
  const dates = await store.getServiceDatesByMonth(monthStr);
  dates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  if (dates.length === 0) {
    alert("No hay cultos agendados en este mes.");
    return;
  }

  const allUsers = await store.getActiveUsers();

  // Config jsPDF
  const doc = new jsPDF('p', 'pt', 'a4');
  let yPos = 40;

  doc.setFontSize(22);
  doc.setTextColor(236, 72, 153); // pink-500
  doc.text("Planificación WorshipStudio", 40, yPos);

  yPos += 20;
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  const monthName = format(parseISO(monthStr + '-01'), 'MMMM yyyy', { locale: es }).toUpperCase();
  doc.text(`MES: ${monthName}`, 40, yPos);

  yPos += 30;

  dates.forEach((date) => {
    // Revisa si necesitamos nueva pagina
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }

    // Card Header
    doc.setFillColor(30, 30, 30); // Dark BG for header
    doc.rect(40, yPos, 515, 60, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(date.dayName, 50, yPos + 20);

    const dirName = allUsers.find(u => u.id === date.directorId)?.name || 'Nadie';
    const choirName = allUsers.filter(u => date.acompaniantesIds.includes(u.id))
      .map(u => u.name.charAt(0).toUpperCase() + u.name.slice(1).toLowerCase())
      .join(', ') || 'Nadie';
    
    doc.setFontSize(10);
    doc.setTextColor(250, 204, 21); // yellow 400
    doc.text(`Preside: ${dirName}`, 150, yPos + 20);
    doc.text(`Coro: ${choirName}`, 150, yPos + 40);

    yPos += 60;

    // Table mapping
    const songsData = date.songs.map((s, idx) => {
      const lead = allUsers.find(u => u.id === s.leadSingerId)?.name || 'Coro Unísono';
      return [
        (idx + 1).toString(),
        s.title,
        s.artist || '-',
        s.tone || '-',
        lead
      ];
    });

    if (songsData.length === 0) {
      doc.setFillColor(240, 235, 255); 
      doc.rect(40, yPos, 515, 40, 'F');
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.text("Sin canciones agendadas.", 50, yPos + 20);
      yPos += 45;
    } else {
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Canción', 'Artista', 'Tono', 'Voz Asignada']],
        body: songsData,
        margin: { left: 40, right: 40 },
        theme: 'grid',
        headStyles: { fillColor: [236, 72, 153], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [245, 245, 250] }
      });
      // @ts-ignore
      yPos = doc.lastAutoTable.finalY + 30;
    }
  });

  doc.save(`Bosquejos_${monthStr}.pdf`);
}

export async function exportMonthToExcel(monthStr: string) {
  const dates = await store.getServiceDatesByMonth(monthStr);
  dates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  if (dates.length === 0) {
    alert("No hay cultos agendados en este mes.");
    return;
  }

  const allUsers = await store.getActiveUsers();

  const rows: any[] = [];
  rows.push(["Rol del mes de " + format(parseISO(monthStr + '-01'), 'MMMM yyyy', { locale: es })]);
  rows.push([]);

  dates.forEach(date => {
    rows.push([date.dayName]);
    rows.push(["Rol", "Nombre", "Canción", "Tono", "Youtube", "Versión"]);

    const dirName = allUsers.find(u => u.id === date.directorId)?.name || 'Sin Asignar';
    const acompNames = date.acompaniantesIds.map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean);

    let cCount = Math.max(date.songs.length, 1 + acompNames.length);

    for (let i = 0; i < cCount; i++) {
      const roleLabel = i === 0 ? "Director" : (i <= acompNames.length ? "Acompañante" : "");
      const nameLabel = i === 0 ? dirName : (i <= acompNames.length ? acompNames[i - 1] : "");
      const song = date.songs[i] || { title: '', tone: '', youtubeUrl: '', version: '' };

      rows.push([
        roleLabel,
        nameLabel,
        song.title,
        song.tone,
        song.youtubeUrl,
        song.version
      ]);
    }
    rows.push([]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rol");
  XLSX.writeFile(workbook, `Rol_${monthStr}.xlsx`);
}
