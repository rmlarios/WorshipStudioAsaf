import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import * as store from './firebaseStore';
import { User, ServiceDate, Availability } from './types';

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

export async function exportMatrixToPDF(
  monthStr: string,
  dates: ServiceDate[],
  allUsers: User[],
  availabilities: Availability[]
) {
  // Sort dates chronologically
  const sortedDates = [...dates].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  if (sortedDates.length === 0) {
    alert("No hay cultos agendados en este mes.");
    return;
  }

  // Create a landscape A4 PDF
  const doc = new jsPDF('l', 'pt', 'a4');
  let yPos = 40;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(236, 72, 153); // pink-500
  doc.text("Matriz de Planificación - WorshipStudio Asaf 148", 40, yPos);

  yPos += 20;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  const monthName = format(parseISO(monthStr + '-01'), 'MMMM yyyy', { locale: es }).toUpperCase();
  doc.text(`MES: ${monthName}`, 40, yPos);

  yPos += 25;

  // Build the headers
  const headers = ['Miembro', ...sortedDates.map(d => format(parseISO(d.dateStr), 'dd MMM', { locale: es }))];

  // Group users by role to match UI grouping
  const directores = allUsers.filter(u => u.role === 'DIRECTOR' && u.visibleInRoles !== false);
  const cantores = allUsers.filter(u => u.role === 'CANTOR' && u.visibleInRoles !== false);
  const musicos = allUsers.filter(u => u.role === 'MUSICO' && u.visibleInRoles !== false);

  const rows: any[] = [];

  const addGroupRows = (groupName: string, users: User[]) => {
    if (users.length === 0) return;
    // Group Header Row
    rows.push([{ content: groupName.toUpperCase(), colSpan: headers.length, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [236, 72, 153] } }]);

    users.forEach(user => {
      const userRow: any[] = [user.name];

      sortedDates.forEach(date => {
        const isDirector = date.directorId === user.id;
        const isAcomp = date.acompaniantesIds.includes(user.id);
        const avail = availabilities.find(a => a.serviceDateId === date.id && a.userId === user.id);
        const isAvailable = avail?.available === true;
        const hasAnswered = !!avail;

        if (isDirector) {
          userRow.push('Líder');
        } else if (isAcomp) {
          userRow.push('Coro');
        } else if (user.role === 'MUSICO' && hasAnswered && isAvailable) {
          userRow.push('Músico');
        } else if (hasAnswered && isAvailable) {
          userRow.push('Disponible');
        } else if (hasAnswered && !isAvailable) {
          userRow.push('Ausente');
        } else {
          userRow.push('-');
        }
      });

      rows.push(userRow);
    });
  };

  addGroupRows('Directores', directores);
  addGroupRows('Cantores', cantores);
  addGroupRows('Músicos', musicos);

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: rows,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 110, fontStyle: 'bold', halign: 'left' }
    },
    styles: { fontSize: 8, cellPadding: 5, halign: 'center', valign: 'middle' },
    didParseCell: (data) => {
      // Check if it's a section header row
      if (data.row.raw && (data.row.raw as any)[0] && typeof (data.row.raw as any)[0] === 'object' && (data.row.raw as any)[0].content) {
        return; // Let the custom styles handle it
      }

      if (data.column.index === 0) return; // Don't style the name column background

      const cellValue = data.cell.raw as string;
      if (!cellValue) return;

      if (cellValue.includes('Líder')) {
        data.cell.styles.fillColor = [254, 240, 138]; // yellow-100
        data.cell.styles.textColor = [133, 77, 14];   // dark yellow/brown
        data.cell.styles.fontStyle = 'bold';
      } else if (cellValue.includes('Coro')) {
        data.cell.styles.fillColor = [252, 231, 243]; // pink-100
        data.cell.styles.textColor = [157, 23, 77];   // dark pink
        data.cell.styles.fontStyle = 'bold';
      } else if (cellValue.includes('Músico')) {
        data.cell.styles.fillColor = [219, 234, 254]; // blue-100
        data.cell.styles.textColor = [30, 58, 138];   // dark blue
        data.cell.styles.fontStyle = 'bold';
      } else if (cellValue === 'Disponible') {
        data.cell.styles.fillColor = [209, 250, 229]; // green-100
        data.cell.styles.textColor = [6, 78, 59];     // dark green
      } else if (cellValue === 'Ausente') {
        data.cell.styles.fillColor = [254, 226, 226]; // red-100
        data.cell.styles.textColor = [153, 27, 27];   // dark red
      } else if (cellValue === '-') {
        data.cell.styles.textColor = [150, 150, 150];
      }
    }
  });

  doc.save(`Matriz_${monthStr}.pdf`);
}

export async function exportMatrixToPNG(tableId: string, monthStr: string) {
  if (typeof window === 'undefined') return;

  const table = document.getElementById(tableId);
  if (!table) {
    alert("No se encontró la tabla para exportar.");
    return;
  }

  // Import dynamic html-to-image to prevent SSR reference errors
  const htmlToImage = await import('html-to-image');

  // Select all elements with sticky class inside the table to reset them temporarily
  const stickyElements = table.querySelectorAll('.sticky');
  const originalClasses = Array.from(stickyElements).map(el => ({
    element: el,
    className: el.className
  }));

  // Temporarily remove sticky positioning classes so they render correctly in the capture clone
  stickyElements.forEach(el => {
    el.classList.remove('sticky');
    el.classList.remove('top-0');
    el.classList.remove('left-0');
    el.classList.remove('z-20');
    el.classList.remove('z-30');
    el.classList.remove('z-40');
  });

  try {
    const dataUrl = await htmlToImage.toPng(table, {
      backgroundColor: '#0d0d0d', // dark mode background color
      style: {
        borderRadius: '0px',
        border: 'none',
      },
      cacheBust: true,
    });

    const link = document.createElement('a');
    link.download = `Matriz_${monthStr}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Error al exportar imagen:", error);
    alert("Hubo un error al generar la imagen de la matriz.");
  } finally {
    // Restore original classes
    originalClasses.forEach(item => {
      item.element.className = item.className;
    });
  }
}
