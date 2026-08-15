/* Jet Market — Sistema de fotos dos agentes
   Prioridade:
   1. photo URL salva no market.players (Admin → Fotos)
   2. DiceBear (avatar gerado pelo nome)
   3. Iniciais (fallback no HTML)
*/

function getPlayerPhoto(player) {
  const raw = player?.photo || player?.photoUrl || player?.image || "";
  if (raw && /^https?:\/\//i.test(String(raw).trim())) {
    return String(raw).trim();
  }
  const seed = encodeURIComponent(player?.name || player?.key || "agent");
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=0d1219,111822`;
}

function getPlayerInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function photoHTML(player, size = 48) {
  const url = getPlayerPhoto(player);
  const initials = getPlayerInitials(player?.name);
  return `
    <div class="agent-photo" style="width:${size}px;height:${size}px;min-width:${size}px">
      <img src="${url}" alt="${player?.name || ""}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
      <span class="photo-fallback" style="display:none">${initials}</span>
    </div>
  `;
}

window.getPlayerPhoto = getPlayerPhoto;
window.getPlayerInitials = getPlayerInitials;
window.photoHTML = photoHTML;
