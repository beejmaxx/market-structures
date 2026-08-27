(() => {
  function initVectorLab(root) {
    const state = { size: 0, capacity: 0, reallocations: 0, moves: 0 };
    const slots = root.querySelector('[data-vector-slots]');
    const log = root.querySelector('[data-vector-log]');
    let newest = -1;

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      setStat('size', state.size);
      setStat('capacity', state.capacity);
      setStat('reallocations', state.reallocations);
      setStat('moves', state.moves);

      slots.replaceChildren();
      if (state.capacity === 0) {
        const empty = document.createElement('span');
        empty.textContent = '∅';
        empty.setAttribute('aria-label', 'No allocation');
        slots.append(empty);
      } else {
        for (let index = 0; index < state.capacity; index += 1) {
          const slot = document.createElement('span');
          slot.textContent = index < state.size ? `v${index}` : String(index);
          slot.classList.toggle('live', index < state.size);
          slot.classList.toggle('new', index === newest);
          slot.setAttribute(
            'aria-label',
            index < state.size ? `Live element ${index}` : `Uninitialized slot ${index}`,
          );
          slots.append(slot);
        }
      }
      log.textContent = message;
      newest = -1;
    }

    function push() {
      if (state.size >= 16) {
        render('The visualizer stops at 16 live elements so the representation stays readable.');
        return;
      }

      if (state.size === state.capacity) {
        const oldCapacity = state.capacity;
        const nextCapacity = oldCapacity === 0 ? 1 : oldCapacity * 2;
        state.moves += state.size;
        state.reallocations += 1;
        state.capacity = nextCapacity;
        newest = state.size;
        state.size += 1;
        render(
          `Growth boundary: allocated ${nextCapacity} slots and moved ${state.size - 1} existing element${state.size - 1 === 1 ? '' : 's'}.`,
        );
        return;
      }

      newest = state.size;
      state.size += 1;
      render('Constructed one element in reserved storage. No allocation and no existing elements moved.');
    }

    function pop() {
      if (state.size === 0) {
        render('The vector is already empty. Capacity remains unchanged.');
        return;
      }
      state.size -= 1;
      render('Destroyed the final live element. Capacity did not shrink.');
    }

    function reserve() {
      if (state.capacity >= 8) {
        render('Capacity is already at least 8, so reserve(8) performs no work.');
        return;
      }
      state.moves += state.size;
      state.reallocations += 1;
      state.capacity = 8;
      render(`Reserved 8 slots and moved ${state.size} existing element${state.size === 1 ? '' : 's'}. Size did not change.`);
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'push') push();
      if (action === 'pop') pop();
      if (action === 'reserve') reserve();
      if (action === 'reset') {
        state.size = 0;
        state.capacity = 0;
        state.reallocations = 0;
        state.moves = 0;
        render('There is no allocation yet.');
      }
    });

    render('There is no allocation yet.');
  }

  function initListLab(root) {
    const addresses = ['0x10f0', '0x3a80', '0x1120', '0x8c40', '0x2050', '0x71d0'];
    let nodes = [
      { id: 'A', address: addresses[0] },
      { id: 'B', address: addresses[1] },
      { id: 'C', address: addresses[2] },
    ];
    let selected = 0;
    let nextId = 1;
    const container = root.querySelector('[data-list-nodes]');
    const writes = root.querySelector('[data-list-writes]');

    function render(message) {
      container.replaceChildren();
      nodes.forEach((node, index) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = `ms-node${index === selected ? ' selected' : ''}`;
        element.dataset.index = String(index);
        element.setAttribute('aria-label', `Select order ${node.id}`);

        const title = document.createElement('strong');
        title.textContent = `order ${node.id}`;
        const prev = document.createElement('span');
        prev.textContent = `prev: ${index > 0 ? nodes[index - 1].id : 'null'}`;
        const next = document.createElement('span');
        next.textContent = `next: ${index + 1 < nodes.length ? nodes[index + 1].id : 'null'}`;
        const address = document.createElement('small');
        address.textContent = node.address;

        element.append(title, prev, next, address);
        container.append(element);
      });
      writes.textContent = message;
    }

    function selectNext() {
      selected = (selected + 1) % nodes.length;
      render(`Selected order ${nodes[selected].id}. No links changed.`);
    }

    function insertAfter() {
      const left = nodes[selected];
      const right = nodes[selected + 1] || null;
      const node = {
        id: `N${nextId}`,
        address: addresses[(nextId + 2) % addresses.length],
      };
      nextId += 1;
      nodes.splice(selected + 1, 0, node);

      const lines = [
        `${node.id}.prev = ${left.id}`,
        `${node.id}.next = ${right ? right.id : 'null'}`,
        `${left.id}.next = ${node.id}`,
        right ? `${right.id}.prev = ${node.id}` : `tail = ${node.id}`,
      ];
      selected += 1;
      render(lines.join('\n'));
    }

    function eraseSelected() {
      if (nodes.length === 1) {
        render('Keep one node in the visualizer. A real list may transition to the empty state.');
        return;
      }
      const node = nodes[selected];
      const left = nodes[selected - 1] || null;
      const right = nodes[selected + 1] || null;
      const lines = [
        left ? `${left.id}.next = ${right ? right.id : 'null'}` : `head = ${right.id}`,
        right ? `${right.id}.prev = ${left ? left.id : 'null'}` : `tail = ${left.id}`,
        `${node.id}.prev = poison`,
        `${node.id}.next = poison`,
      ];
      nodes.splice(selected, 1);
      selected = Math.min(selected, nodes.length - 1);
      render(lines.join('\n'));
    }

    root.addEventListener('click', (event) => {
      const node = event.target.closest('.ms-node[data-index]');
      if (node) {
        selected = Number(node.dataset.index);
        render(`Selected order ${nodes[selected].id}. No links changed.`);
        return;
      }

      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'next') selectNext();
      if (button.dataset.action === 'insert') insertAfter();
      if (button.dataset.action === 'erase') eraseSelected();
      if (button.dataset.action === 'reset') {
        nodes = [
          { id: 'A', address: addresses[0] },
          { id: 'B', address: addresses[1] },
          { id: 'C', address: addresses[2] },
        ];
        selected = 0;
        nextId = 1;
        render('Selected order A. Select an operation to see the pointer writes.');
      }
    });

    render('Selected order A. Select an operation to see the pointer writes.');
  }

  function initialize() {
    document.querySelectorAll('[data-ms-vector]').forEach(initVectorLab);
    document.querySelectorAll('[data-ms-list]').forEach(initListLab);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
