/**
 * Generate a URL-safe ID from a title
 * @param {string} title - The title to convert to an ID
 * @param {string} type - The type prefix (event, span, era)
 * @returns {string} - The generated ID
 */
export function generateIdFromTitle(title, type) {
  const sanitized = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  return `${type}-${sanitized}`;
}

export function makeUniqueId(baseId, elements, excludeId) {
  const ids = new Set(elements.map((el) => el.id));
  if (excludeId) ids.delete(excludeId);
  if (!ids.has(baseId)) return baseId;
  let counter = 2;
  let nextId = `${baseId}-${counter}`;
  while (ids.has(nextId)) {
    counter += 1;
    nextId = `${baseId}-${counter}`;
  }
  return nextId;
}

/**
 * Update all references to an element ID throughout the timeline data
 * @param {Object} timelineData 
 * @param {string} oldId 
 * @param {string} newId 
 * @returns {Object} 
 */
export function updateElementReferences(timelineData, oldId, newId) {
  const updatedElements = timelineData.elements.map(element => {
    const updated = { ...element };

    if (element.type === 'event' && element.parents) {
      updated.parents = element.parents.map(parentId =>
        parentId === oldId ? newId : parentId
      );
    }

    if (element.type === 'span') {
      if (element.parent === oldId) {
        updated.parent = newId;
      }
      if (element.mergeParent === oldId) {
        updated.mergeParent = newId;
      }
    }

    return updated;
  });

  return {
    ...timelineData,
    elements: updatedElements,
  };
}

/**
 * Update an element with a new ID and update all references
 * @param {Object} timelineData 
 * @param {Object} updatedElement 
 * @param {string} originalId 
 * @returns {Object} 
 */
export function updateElementWithNewId(timelineData, updatedElement, originalId) {
  const titleChanged = timelineData.elements.find(el => el.id === originalId)?.title !== updatedElement.title;

  if (!titleChanged) {
    return {
      ...timelineData,
      elements: timelineData.elements.map(el =>
        el.id === originalId ? updatedElement : el
      ),
    };
  }

  const baseId = generateIdFromTitle(updatedElement.title, updatedElement.type);
  const newId = makeUniqueId(baseId, timelineData.elements, originalId);

  const elementWithNewId = {
    ...updatedElement,
    id: newId,
  };

  const originalElement = timelineData.elements.find(el => el.id === originalId);
  if (originalElement?.noteFile) {
    elementWithNewId.noteFile = `${newId}.md`;
  }

  const elementsWithUpdatedElement = timelineData.elements.map(el =>
    el.id === originalId ? elementWithNewId : el
  );

  const dataWithUpdatedElement = {
    ...timelineData,
    elements: elementsWithUpdatedElement,
  };

  return updateElementReferences(dataWithUpdatedElement, originalId, newId);
}
