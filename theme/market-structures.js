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

  function initRingLab(root) {
    const capacity = 8;
    let slots = Array(capacity).fill(null);
    let head = 0;
    let size = 0;
    let rejected = 0;
    let nextValue = 1;
    const container = root.querySelector('[data-ring-slots]');
    const log = root.querySelector('[data-ring-log]');
    const policy = root.querySelector('[data-ring-policy]');

    function tail() {
      return (head + size) % capacity;
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      setStat('head', head);
      setStat('tail', tail());
      setStat('size', `${size} / ${capacity}`);
      setStat('rejected', rejected);
      container.replaceChildren();

      slots.forEach((value, index) => {
        const slot = document.createElement('div');
        slot.className = 'ms-ring-slot';
        slot.classList.toggle('live', value !== null);
        slot.classList.toggle('head', index === head);
        slot.classList.toggle('tail', index === tail());

        const physical = document.createElement('small');
        physical.textContent = `slot ${index}`;
        const payload = document.createElement('strong');
        payload.textContent = value === null ? '·' : value;
        const pointers = document.createElement('span');
        pointers.className = 'ms-ring-pointers';
        const labels = [];
        if (index === head) labels.push(size === 0 ? 'head (empty)' : 'head');
        if (index === tail()) labels.push(size === capacity ? 'next write if overwrite' : 'next write');
        pointers.textContent = labels.join(' + ');

        slot.append(physical, payload, pointers);
        container.append(slot);
      });

      log.textContent = message;
    }

    function enqueueOne() {
      const value = `m${nextValue}`;
      nextValue += 1;

      if (size === capacity) {
        if (policy.value === 'reject') {
          rejected += 1;
          return { outcome: 'rejected', value };
        }

        const overwritten = slots[head];
        slots[head] = value;
        head = (head + 1) % capacity;
        return { outcome: 'overwritten', value, overwritten };
      }

      const writeIndex = tail();
      slots[writeIndex] = value;
      size += 1;
      return { outcome: 'accepted', value, index: writeIndex };
    }

    function describe(result) {
      if (result.outcome === 'rejected') {
        return `${result.value} was rejected because the ring is full. Existing FIFO order is unchanged.`;
      }
      if (result.outcome === 'overwritten') {
        return `${result.value} overwrote oldest item ${result.overwritten}; head advanced to preserve the order of surviving items.`;
      }
      return `${result.value} was constructed in slot ${result.index}. No existing item moved.`;
    }

    function dequeueOne() {
      if (size === 0) return null;
      const readIndex = head;
      const value = slots[readIndex];
      slots[readIndex] = null;
      head = (head + 1) % capacity;
      size -= 1;
      return { value, index: readIndex };
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;

      if (action === 'enqueue') {
        render(describe(enqueueOne()));
      }

      if (action === 'dequeue') {
        const result = dequeueOne();
        render(
          result
            ? `${result.value} was destroyed and returned from slot ${result.index}; head advanced modulo ${capacity}.`
            : 'The ring is empty, so dequeue has no value to return.',
        );
      }

      if (action === 'burst') {
        const results = Array.from({ length: 5 }, enqueueOne);
        const counts = results.reduce(
          (total, result) => {
            total[result.outcome] += 1;
            return total;
          },
          { accepted: 0, rejected: 0, overwritten: 0 },
        );
        render(
          `Burst result: ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.overwritten} overwrote the oldest item.`,
        );
      }

      if (action === 'drain') {
        const count = size;
        while (size > 0) dequeueOne();
        render(`Drained ${count} item${count === 1 ? '' : 's'} in FIFO order. Capacity and storage did not change.`);
      }

      if (action === 'reset') {
        slots = Array(capacity).fill(null);
        head = 0;
        size = 0;
        rejected = 0;
        nextValue = 1;
        render('The ring is empty. Head and next-write both name slot 0.');
      }
    });

    policy.addEventListener('change', () => {
      render(
        policy.value === 'reject'
          ? 'Full policy changed to reject. Existing items will never be displaced by a new enqueue.'
          : 'Full policy changed to overwrite. A full enqueue will replace the oldest item and advance head.',
      );
    });

    render('The ring is empty. Head and next-write both name slot 0.');
  }

  function initArrayLab(root) {
    const length = 16;
    const cacheLineBytes = 64;
    const elementSizeControl = root.querySelector('[data-array-element-size]');
    const strideControl = root.querySelector('[data-array-stride]');
    const container = root.querySelector('[data-array-slots]');
    const log = root.querySelector('[data-array-log]');
    let touched = new Set();
    let nextIndex = 0;
    let current = -1;

    function elementSize() {
      return Number(elementSizeControl.value);
    }

    function stride() {
      return Number(strideControl.value);
    }

    function cacheLine(index) {
      return Math.floor((index * elementSize()) / cacheLineBytes);
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      const lines = new Set(Array.from(touched, cacheLine));
      setStat('reads', touched.size);
      setStat('lines', lines.size);
      setStat('useful', touched.size * elementSize());
      setStat('fetched', lines.size * cacheLineBytes);
      container.replaceChildren();

      for (let index = 0; index < length; index += 1) {
        const slot = document.createElement('div');
        slot.className = 'ms-array-slot';
        slot.classList.toggle('touched', touched.has(index));
        slot.classList.toggle('current', index === current);

        const label = document.createElement('span');
        label.textContent = `[${index}]`;
        const value = document.createElement('strong');
        value.textContent = touched.has(index) ? `v${index}` : '·';
        const line = document.createElement('small');
        line.textContent = `line ${cacheLine(index)}`;

        slot.append(label, value, line);
        container.append(slot);
      }

      log.textContent = message;
    }

    function reset(message = 'No elements have been read.') {
      touched = new Set();
      nextIndex = 0;
      current = -1;
      render(message);
    }

    function step() {
      if (nextIndex >= length) {
        render('The strided scan is complete. Reset or change a parameter to run again.');
        return false;
      }
      current = nextIndex;
      touched.add(current);
      nextIndex += stride();
      render(
        `Read element ${current} at byte offset ${current * elementSize()}, requiring cache line ${cacheLine(current)} in this model.`,
      );
      return true;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'step') step();
      if (button.dataset.action === 'run') {
        while (step()) {
          // Run the same state transition until the stride exits the array.
        }
        render(
          `Scan complete: ${touched.size} elements used ${touched.size * elementSize()} bytes from ${new Set(Array.from(touched, cacheLine)).size * cacheLineBytes} modeled bytes fetched.`,
        );
      }
      if (button.dataset.action === 'reset') reset();
    });

    function resetForConfiguration() {
      reset(`Model reset for ${elementSize()}-byte elements with stride ${stride()}.`);
    }

    elementSizeControl.addEventListener('change', resetForConfiguration);
    strideControl.addEventListener('change', resetForConfiguration);
    reset();
  }

  function initStackLab(root) {
    const capacity = 8;
    let values = [];
    let nextValue = 1;
    let rejected = 0;
    const container = root.querySelector('[data-stack-slots]');
    const log = root.querySelector('[data-stack-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      setStat('size', `${values.length} / ${capacity}`);
      setStat('top', values.length === 0 ? 'none' : values.length - 1);
      setStat('next', values.length === capacity ? 'full' : values.length);
      setStat('rejected', rejected);
      container.replaceChildren();

      for (let index = capacity - 1; index >= 0; index -= 1) {
        const slot = document.createElement('div');
        slot.className = 'ms-stack-slot';
        slot.classList.toggle('live', index < values.length);
        slot.classList.toggle('top', index === values.length - 1);

        const label = document.createElement('span');
        label.textContent = `slot ${index}`;
        const value = document.createElement('strong');
        value.textContent = index < values.length ? values[index] : 'uninitialized';
        const marker = document.createElement('small');
        marker.textContent = index === values.length - 1 ? '← top' : '';
        slot.append(label, value, marker);
        container.append(slot);
      }
      log.textContent = message;
    }

    function push() {
      const value = `v${nextValue}`;
      nextValue += 1;
      if (values.length === capacity) {
        rejected += 1;
        return `${value} was rejected. The stack is full and no live element changed.`;
      }
      values.push(value);
      return `${value} was constructed in slot ${values.length - 1} and became the new top.`;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;

      if (action === 'push') render(push());
      if (action === 'peek') {
        render(
          values.length === 0
            ? 'Peek has no value because the stack is empty.'
            : `${values[values.length - 1]} is the top. Peek did not mutate the stack.`,
        );
      }
      if (action === 'pop') {
        if (values.length === 0) {
          render('Pop returned no value because the stack is empty.');
        } else {
          const index = values.length - 1;
          const value = values.pop();
          render(`${value} was moved out and destroyed from slot ${index}. Lower elements did not shift.`);
        }
      }
      if (action === 'fill') {
        const count = capacity - values.length;
        let finalMessage = '';
        while (values.length < capacity) finalMessage = push();
        render(count === 0 ? 'The stack is already full.' : `Filled ${count} slot${count === 1 ? '' : 's'}. ${finalMessage}`);
      }
      if (action === 'reset') {
        values = [];
        nextValue = 1;
        rejected = 0;
        render('The stack is empty.');
      }
    });

    render('The stack is empty.');
  }

  function initHeapLab(root) {
    const sequence = [42, 17, 63, 8, 55, 29, 71, 12, 48, 34];
    let heap = [];
    let cursor = 0;
    let comparisons = 0;
    let swaps = 0;
    let path = new Set();
    const container = root.querySelector('[data-heap-nodes]');
    const log = root.querySelector('[data-heap-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function exchange(left, right) {
      [heap[left], heap[right]] = [heap[right], heap[left]];
      swaps += 1;
      path.add(left);
      path.add(right);
    }

    function greater(left, right) {
      comparisons += 1;
      return heap[left] > heap[right];
    }

    function siftUp(start) {
      let index = start;
      path.add(index);
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (!greater(index, parent)) break;
        exchange(index, parent);
        index = parent;
      }
    }

    function siftDown(start) {
      let index = start;
      path.add(index);
      while (true) {
        const left = index * 2 + 1;
        if (left >= heap.length) break;
        const right = left + 1;
        let best = left;
        if (right < heap.length && greater(right, left)) best = right;
        if (!greater(best, index)) break;
        exchange(index, best);
        index = best;
      }
    }

    function resetCounters() {
      comparisons = 0;
      swaps = 0;
      path = new Set();
    }

    function render(message) {
      setStat('size', heap.length);
      setStat('root', heap.length ? heap[0] : 'none');
      setStat('comparisons', comparisons);
      setStat('swaps', swaps);
      container.replaceChildren();
      heap.forEach((value, index) => {
        const node = document.createElement('div');
        node.className = `ms-heap-node${path.has(index) ? ' path' : ''}`;
        const key = document.createElement('strong');
        key.textContent = String(value);
        const label = document.createElement('span');
        label.textContent = `index ${index}`;
        node.append(key, label);
        container.append(node);
      });
      log.textContent = message;
    }

    function nextValue() {
      const value = sequence[cursor % sequence.length];
      cursor += 1;
      return value;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      resetCounters();

      if (action === 'push') {
        const value = nextValue();
        heap.push(value);
        siftUp(heap.length - 1);
        render(`Appended ${value}, then repaired upward through indices ${Array.from(path).join(', ')}.`);
      }
      if (action === 'pop') {
        if (heap.length === 0) {
          render('The heap is empty.');
        } else {
          const maximum = heap[0];
          const last = heap.pop();
          if (heap.length) {
            heap[0] = last;
            siftDown(0);
          }
          render(`Removed maximum ${maximum}; the replacement repaired downward.`);
        }
      }
      if (action === 'replace') {
        if (heap.length === 0) {
          render('Push at least one value before replacing the root.');
        } else {
          const old = heap[0];
          const value = nextValue();
          heap[0] = value;
          siftDown(0);
          render(`Replaced root ${old} with ${value}, then restored heap order.`);
        }
      }
      if (action === 'heapify') {
        heap = [12, 71, 8, 55, 29, 63, 17, 42];
        for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) siftDown(index);
        render('Bottom-up heapify repaired every internal node from right to left.');
      }
      if (action === 'reset') {
        heap = [];
        cursor = 0;
        render('The heap is empty.');
      }
    });

    render('The heap is empty.');
  }

  function initHashLab(root) {
    const capacity = 8;
    const keys = [18, 26, 34, 42, 58];
    let slots = Array(capacity).fill(null);
    let cursor = 0;
    let probes = [];
    const container = root.querySelector('[data-hash-slots]');
    const log = root.querySelector('[data-hash-log]');

    function ideal(key) {
      return key % capacity;
    }

    function liveCount() {
      return slots.filter((slot) => typeof slot === 'number').length;
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      const live = liveCount();
      setStat('size', live);
      setStat('load', (live / capacity).toFixed(2));
      setStat('probes', probes.length);
      setStat('tombstones', slots.filter((slot) => slot === 'tombstone').length);
      container.replaceChildren();
      slots.forEach((value, index) => {
        const cell = document.createElement('div');
        const state = typeof value === 'number' ? 'occupied' : value === 'tombstone' ? 'tombstone' : 'empty';
        cell.className = `ms-hash-slot ${state}${probes.includes(index) ? ' probed' : ''}`;
        const key = document.createElement('strong');
        key.textContent = state === 'occupied' ? String(value) : state === 'tombstone' ? 'tomb' : 'empty';
        const label = document.createElement('span');
        label.textContent = `bucket ${index}`;
        cell.append(key, label);
        container.append(cell);
      });
      log.textContent = message;
    }

    function locate(key, forInsert = false) {
      probes = [];
      let firstTombstone = -1;
      for (let distance = 0; distance < capacity; distance += 1) {
        const index = (ideal(key) + distance) % capacity;
        probes.push(index);
        const slot = slots[index];
        if (slot === key) return { found: true, index };
        if (slot === 'tombstone' && firstTombstone < 0) firstTombstone = index;
        if (slot === null) {
          return { found: false, index: forInsert && firstTombstone >= 0 ? firstTombstone : index };
        }
      }
      return { found: false, index: forInsert ? firstTombstone : -1 };
    }

    function find(key) {
      const result = locate(key);
      render(
        result.found
          ? `Found ${key} in bucket ${result.index} after ${probes.length} probe${probes.length === 1 ? '' : 's'}.`
          : `${key} is absent. Lookup stopped after ${probes.length} probe${probes.length === 1 ? '' : 's'}.`,
      );
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;

      if (action === 'insert') {
        const key = keys[cursor % keys.length];
        cursor += 1;
        const result = locate(key, true);
        if (result.found) render(`${key} is already present; insertion made no duplicate.`);
        else if (result.index < 0) render(`The table is full; ${key} was rejected.`);
        else {
          slots[result.index] = key;
          render(`Inserted ${key} in bucket ${result.index}; its ideal bucket is ${ideal(key)}.`);
        }
      }
      if (action === 'find') find(34);
      if (action === 'miss') find(50);
      if (action === 'delete') {
        const result = locate(26);
        if (result.found) {
          slots[result.index] = 'tombstone';
          render(`Deleted 26 from bucket ${result.index}, leaving a tombstone so later keys remain reachable.`);
        } else render('26 is absent. Insert it before deleting it.');
      }
      if (action === 'reset') {
        slots = Array(capacity).fill(null);
        cursor = 0;
        probes = [];
        render('Every slot is empty.');
      }
    });

    render('Every slot is empty.');
  }

  function initOrderedLab(root) {
    const sorted = [8, 17, 29, 42, 55, 63, 71];
    const tree = [42, 17, 63, 8, 29, 55, 71];
    const arrayRoot = root.querySelector('[data-ordered-array]');
    const treeRoot = root.querySelector('[data-ordered-tree]');
    const log = root.querySelector('[data-ordered-log]');
    let arrayPath = [];
    let treePath = [];
    let answer = null;

    function renderNodes(container, values, path) {
      container.replaceChildren();
      values.forEach((value, index) => {
        const node = document.createElement('span');
        node.className = `ms-ordered-node${path.includes(index) ? ' visited' : ''}${value === answer ? ' answer' : ''}`;
        node.textContent = String(value);
        container.append(node);
      });
    }

    function render(message) {
      renderNodes(arrayRoot, sorted, arrayPath);
      renderNodes(treeRoot, tree, treePath);
      log.textContent = message;
    }

    function query(target) {
      arrayPath = [];
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        arrayPath.push(mid);
        if (sorted[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      answer = lo < sorted.length ? sorted[lo] : null;

      treePath = [];
      let index = 0;
      let candidate = null;
      while (index < tree.length) {
        treePath.push(index);
        if (tree[index] >= target) {
          candidate = tree[index];
          index = index * 2 + 1;
        } else index = index * 2 + 2;
      }
      render(`lower_bound(${target}) = ${answer ?? 'end'}; array touched ${arrayPath.length}, tree touched ${treePath.length}. Tree candidate: ${candidate ?? 'end'}.`);
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.action === 'reset') {
        arrayPath = [];
        treePath = [];
        answer = null;
        render('Select a query to expose both access paths.');
      } else if (button.dataset.key) query(Number(button.dataset.key));
    });

    render('Select a query to expose both access paths.');
  }

  function initTrieLab(root) {
    const words = new Set(['AMD', 'AMZN', 'ASK']);
    const pathRoot = root.querySelector('[data-trie-path]');
    const log = root.querySelector('[data-trie-log]');

    function render(text, mode) {
      pathRoot.replaceChildren();
      const labels = [{ label: 'root', missing: false }];
      let prefix = '';
      for (const character of text) {
        prefix += character;
        const exists = [...words].some((word) => word.startsWith(prefix));
        labels.push({ label: character, missing: !exists });
        if (!exists) break;
      }
      labels.forEach((label, index) => {
        const node = document.createElement('span');
        const isTerminal = mode === 'word' && index === labels.length - 1 && words.has(text);
        node.className = `ms-trie-node${isTerminal ? ' terminal' : ''}${label.missing ? ' missing' : ''}`;
        node.textContent = label.label;
        pathRoot.append(node);
      });

      if (mode === 'prefix') {
        const matches = [...words].filter((word) => word.startsWith(text));
        log.textContent = `Prefix ${text} reaches a subtree containing: ${matches.join(', ')}.`;
      } else if (words.has(text)) {
        log.textContent = `${text} consumed a complete path and ended at a terminal value.`;
      } else {
        const knownPrefix = [...words].some((word) => word.startsWith(text[0] || ''));
        log.textContent = knownPrefix
          ? `${text} diverges before a terminal; exact lookup is absent.`
          : `${text} has no root edge for ${text[0]}; exact lookup stops immediately.`;
      }
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.action === 'reset') {
        pathRoot.replaceChildren();
        log.textContent = 'Select a key or prefix.';
      } else if (button.dataset.word) render(button.dataset.word, 'word');
      else if (button.dataset.prefix) render(button.dataset.prefix, 'prefix');
    });
  }

  function initGraphLab(root) {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const adjacency = [[1, 2], [0, 3], [0, 3, 4], [1, 2, 5], [2, 5], [3, 4]];
    const unionEdges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5]];
    let parent = names.map((_, index) => index);
    let sizes = names.map(() => 1);
    let unionCursor = 0;
    let visitOrder = [];
    let edgesExamined = 0;
    const container = root.querySelector('[data-graph-nodes]');
    const log = root.querySelector('[data-graph-log]');

    function find(vertex) {
      while (parent[vertex] !== vertex) {
        parent[vertex] = parent[parent[vertex]];
        vertex = parent[vertex];
      }
      return vertex;
    }

    function components() {
      return new Set(names.map((_, index) => find(index))).size;
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message, algorithm = 'none') {
      setStat('algorithm', algorithm);
      setStat('visited', visitOrder.length);
      setStat('components', components());
      setStat('edges', edgesExamined);
      const roots = [...new Set(names.map((_, index) => find(index)))];
      container.replaceChildren();
      names.forEach((name, index) => {
        const node = document.createElement('span');
        const component = roots.indexOf(find(index));
        node.className = `ms-graph-node component-${component}${visitOrder.includes(index) ? ' visited' : ''}`;
        const order = visitOrder.indexOf(index);
        node.textContent = order >= 0 ? `${name} · ${order + 1}` : name;
        container.append(node);
      });
      log.textContent = message;
    }

    function traverse(mode) {
      const seen = Array(names.length).fill(false);
      const worklist = [0];
      seen[0] = true;
      visitOrder = [];
      edgesExamined = 0;
      while (worklist.length) {
        const vertex = mode === 'BFS' ? worklist.shift() : worklist.pop();
        visitOrder.push(vertex);
        const neighbors = mode === 'DFS' ? [...adjacency[vertex]].reverse() : adjacency[vertex];
        neighbors.forEach((next) => {
          edgesExamined += 1;
          if (!seen[next]) {
            seen[next] = true;
            worklist.push(next);
          }
        });
      }
      render(`${mode} visit order: ${visitOrder.map((index) => names[index]).join(' -> ')}.`, mode);
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'bfs') traverse('BFS');
      if (action === 'dfs') traverse('DFS');
      if (action === 'union') {
        const [left, right] = unionEdges[unionCursor % unionEdges.length];
        unionCursor += 1;
        let leftRoot = find(left);
        let rightRoot = find(right);
        if (leftRoot !== rightRoot) {
          if (sizes[leftRoot] < sizes[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
          parent[rightRoot] = leftRoot;
          sizes[leftRoot] += sizes[rightRoot];
        }
        visitOrder = [];
        edgesExamined = 0;
        render(`union(${names[left]}, ${names[right]}) merged their components.`, 'DSU');
      }
      if (action === 'reset') {
        parent = names.map((_, index) => index);
        sizes = names.map(() => 1);
        unionCursor = 0;
        visitOrder = [];
        edgesExamined = 0;
        render('Edges: A-B, A-C, B-D, C-D, C-E, D-F, E-F.');
      }
    });

    render('Edges: A-B, A-C, B-D, C-D, C-E, D-F, E-F.');
  }

  function initBitmapLab(root) {
    const capacity = 32;
    const sequence = [5, 12, 20, 7, 28, 13];
    const occupied = new Set();
    let sequenceCursor = 0;
    let cursor = 0;
    let result = null;
    const container = root.querySelector('[data-bitmap-bits]');
    const log = root.querySelector('[data-bitmap-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function wordValue() {
      let word = 0;
      occupied.forEach((bit) => { word |= (1 << bit) >>> 0; });
      return word >>> 0;
    }

    function render(message) {
      setStat('cursor', cursor);
      setStat('occupied', occupied.size);
      setStat('word', `0x${wordValue().toString(16).padStart(8, '0')}`);
      setStat('result', result ?? 'none');
      container.replaceChildren();
      for (let bit = 0; bit < capacity; bit += 1) {
        const cell = document.createElement('span');
        cell.className = `ms-bit${occupied.has(bit) ? ' set' : ''}${bit === cursor ? ' cursor' : ''}${bit === result ? ' result' : ''}`;
        cell.textContent = String(bit);
        container.append(cell);
      }
      log.textContent = message;
    }

    function scan(direction) {
      result = null;
      if (direction > 0) {
        for (let bit = cursor + 1; bit < capacity; bit += 1) {
          if (occupied.has(bit)) { result = bit; break; }
        }
      } else {
        for (let bit = cursor - 1; bit >= 0; bit -= 1) {
          if (occupied.has(bit)) { result = bit; break; }
        }
      }
      if (result !== null) cursor = result;
      render(result === null ? 'No occupied level exists in that direction.' : `The bit scan found occupied tick ${result}.`);
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      result = null;
      if (action === 'set') {
        const bit = sequence[sequenceCursor % sequence.length];
        sequenceCursor += 1;
        occupied.add(bit);
        cursor = bit;
        render(`Set tick ${bit}; the word changed with one OR mask.`);
      }
      if (action === 'clear') {
        const removed = occupied.delete(cursor);
        render(removed ? `Cleared tick ${cursor} with one AND mask.` : `Tick ${cursor} was already clear.`);
      }
      if (action === 'next') scan(1);
      if (action === 'previous') scan(-1);
      if (action === 'reset') {
        occupied.clear();
        sequenceCursor = 0;
        cursor = 0;
        render('No levels are occupied.');
      }
    });

    render('No levels are occupied.');
  }

  function initRangeLab(root) {
    const initial = [2, 1, 3, 0, 4, 2, 1, 5];
    let values = [...initial];
    let tree = [];
    let touched = [];
    let operation = 'none';
    let answer = 'none';
    const valuesRoot = root.querySelector('[data-range-values]');
    const treeRoot = root.querySelector('[data-range-tree]');
    const log = root.querySelector('[data-range-log]');

    function rebuild() {
      tree = Array(values.length + 1).fill(0);
      values.forEach((value, zeroIndex) => {
        for (let index = zeroIndex + 1; index <= values.length; index += index & -index) tree[index] += value;
      });
    }

    function prefix(end, record = true) {
      let sum = 0;
      for (let index = end; index > 0; index -= index & -index) {
        sum += tree[index];
        if (record) touched.push(index);
      }
      return sum;
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function renderSlots(container, data, oneBased) {
      container.replaceChildren();
      data.forEach((value, index) => {
        const logicalIndex = oneBased ? index + 1 : index;
        const node = document.createElement('span');
        node.className = `ms-range-node${oneBased && touched.includes(logicalIndex) ? ' touched' : ''}`;
        node.textContent = `${logicalIndex}:${value}`;
        container.append(node);
      });
    }

    function render(message) {
      setStat('operation', operation);
      setStat('answer', answer);
      setStat('touched', touched.length);
      setStat('total', values.reduce((sum, value) => sum + value, 0));
      renderSlots(valuesRoot, values, false);
      renderSlots(treeRoot, tree.slice(1), true);
      log.textContent = message;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      touched = [];
      answer = 'none';
      if (action === 'prefix') {
        operation = 'prefix';
        answer = prefix(5);
        render(`prefix(5) followed tree indices ${touched.join(' -> ')}.`);
      }
      if (action === 'range') {
        operation = 'range';
        const right = prefix(7);
        const left = prefix(2);
        answer = right - left;
        render(`range [2, 7) subtracts two prefix paths; touched ${touched.join(', ')}.`);
      }
      if (action === 'update') {
        operation = 'update';
        values[3] += 4;
        for (let index = 4; index <= values.length; index += index & -index) {
          tree[index] += 4;
          touched.push(index);
        }
        answer = values[3];
        render(`Added 4 at value index 3; propagated through tree indices ${touched.join(' -> ')}.`);
      }
      if (action === 'reset') {
        values = [...initial];
        rebuild();
        operation = 'none';
        render('Select a query or point update.');
      }
    });

    rebuild();
    render('Select a query or point update.');
  }

  function initCacheLab(root) {
    const capacity = 32;
    const patterns = {
      sequential: [0, 1, 2, 3, 4, 5, 6, 7],
      stride: [0, 5, 10, 15, 20, 25, 30, 3],
      dependent: [0, 19, 6, 27, 12, 31, 9, 22],
    };
    let touched = [];
    let dependency = 'none';
    const container = root.querySelector('[data-cache-slots]');
    const log = root.querySelector('[data-cache-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      const lines = new Set(touched.map((index) => Math.floor(index / 4)));
      setStat('loads', touched.length);
      setStat('lines', lines.size);
      setStat('density', lines.size ? (touched.length / lines.size).toFixed(1) : '0.0');
      setStat('dependency', dependency);
      container.replaceChildren();
      for (let index = 0; index < capacity; index += 1) {
        const slot = document.createElement('span');
        slot.className = `ms-cache-slot${touched.includes(index) ? ' touched' : ''}${index === touched[touched.length - 1] ? ' current' : ''}`;
        slot.textContent = String(index);
        container.append(slot);
      }
      log.textContent = message;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'reset') {
        touched = [];
        dependency = 'none';
        render('Select an address pattern.');
        return;
      }
      touched = [...patterns[action]];
      dependency = action === 'dependent' ? 'serial' : 'independent';
      const descriptions = {
        sequential: 'Sequential loads used all four modeled elements from each of two lines.',
        stride: 'The stride spread eight loads across eight modeled cache lines.',
        dependent: 'Each loaded value selects the next address, so the eight loads form one dependency chain.',
      };
      render(descriptions[action]);
    });

    render('Select an address pattern.');
  }

  function initPoolLab(root) {
    const capacity = 8;
    let slots;
    let freeStack;
    let selected;
    let nextOrder;
    let staleHandle;
    const container = root.querySelector('[data-pool-slots]');
    const log = root.querySelector('[data-pool-log]');

    function resetState() {
      slots = Array.from({ length: capacity }, () => ({ live: false, generation: 0, value: null }));
      freeStack = Array.from({ length: capacity }, (_, index) => capacity - 1 - index);
      selected = null;
      nextOrder = 1;
      staleHandle = null;
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      setStat('live', slots.filter((slot) => slot.live).length);
      setStat('free', freeStack.length);
      setStat('top', freeStack.length ? freeStack[freeStack.length - 1] : 'none');
      setStat('selected', selected === null ? 'none' : selected);
      container.replaceChildren();
      slots.forEach((slot, index) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.dataset.index = String(index);
        const isTop = freeStack[freeStack.length - 1] === index;
        cell.className = `ms-pool-slot${slot.live ? ' live' : ''}${selected === index ? ' selected' : ''}${isTop ? ' free-top' : ''}`;
        const value = document.createElement('strong');
        value.textContent = slot.live ? slot.value : isTop ? 'free top' : 'free';
        const label = document.createElement('span');
        label.textContent = `slot ${index} · gen ${slot.generation}`;
        cell.append(value, label);
        container.append(cell);
      });
      log.textContent = message;
    }

    root.addEventListener('click', (event) => {
      const slotButton = event.target.closest('.ms-pool-slot[data-index]');
      if (slotButton) {
        selected = Number(slotButton.dataset.index);
        render(`Selected slot ${selected}.`);
        return;
      }
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'allocate') {
        if (!freeStack.length) {
          render('The pool is full; allocation returned Full without changing a live object.');
        } else {
          const index = freeStack.pop();
          slots[index].live = true;
          slots[index].value = `order ${nextOrder}`;
          nextOrder += 1;
          selected = index;
          render(`Popped slot ${index}, constructed ${slots[index].value}, and returned handle (${index}, ${slots[index].generation}).`);
        }
      }
      if (action === 'free') {
        if (selected === null || !slots[selected].live) {
          render('Select a live slot before freeing it.');
        } else {
          const slot = slots[selected];
          staleHandle = { index: selected, generation: slot.generation };
          const value = slot.value;
          slot.live = false;
          slot.value = null;
          slot.generation += 1;
          freeStack.push(selected);
          render(`Destroyed ${value}, incremented generation, and pushed slot ${selected} onto the LIFO free stack.`);
        }
      }
      if (action === 'stale') {
        if (!staleHandle) render('Free a live slot to create an old handle first.');
        else {
          const slot = slots[staleHandle.index];
          const valid = slot.live && slot.generation === staleHandle.generation;
          render(`Old handle (${staleHandle.index}, ${staleHandle.generation}) is ${valid ? 'valid' : 'stale'}; current generation is ${slot.generation}.`);
        }
      }
      if (action === 'reset') {
        resetState();
        render('All slots are free; allocation will pop slot 0.');
      }
    });

    resetState();
    render('All slots are free; allocation will pop slot 0.');
  }

  function initLayoutLab(root) {
    const fields = ['id', 'price', 'qty', 'flags'];
    const count = 6;
    const aosRoot = root.querySelector('[data-layout-aos]');
    const soaRoot = root.querySelector('[data-layout-soa]');
    const log = root.querySelector('[data-layout-log]');
    let selected = () => false;
    let stats = { useful: 0, streams: 0, records: 0, shape: 'none' };

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function makeCell(record, field, extraClass = '') {
      const cell = document.createElement('span');
      cell.className = `ms-field-cell${selected(record, field) ? ' useful' : ''}${extraClass}`;
      cell.textContent = `${field} ${record}`;
      return cell;
    }

    function render(message) {
      Object.entries(stats).forEach(([name, value]) => setStat(name, value));
      aosRoot.replaceChildren();
      for (let record = 0; record < count; record += 1) {
        fields.forEach((field, fieldIndex) => {
          aosRoot.append(makeCell(record, field, fieldIndex === 0 ? ' record-edge' : ''));
        });
      }
      soaRoot.replaceChildren();
      fields.forEach((field) => {
        for (let record = 0; record < count; record += 1) {
          soaRoot.append(makeCell(record, field, record === 0 ? ' stream-edge' : ''));
        }
      });
      log.textContent = message;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'price') {
        selected = (_, field) => field === 'price';
        stats = { useful: 6, streams: 1, records: 6, shape: 'field scan' };
        render('SoA places the six useful price fields in one dense stream; AoS interleaves three unused fields per record.');
      }
      if (action === 'record') {
        selected = (record) => record === 2;
        stats = { useful: 4, streams: 4, records: 1, shape: 'one record' };
        render('AoS keeps the four fields of order 2 adjacent; SoA gathers them from four field streams.');
      }
      if (action === 'cold') {
        selected = (_, field) => field === 'flags';
        stats = { useful: 6, streams: 1, records: 6, shape: 'cold scan' };
        render('A flags-only scan favors dense field storage, but splitting cold flags adds an indirection when a full record needs them.');
      }
      if (action === 'reset') {
        selected = () => false;
        stats = { useful: 0, streams: 0, records: 0, shape: 'none' };
        render('Select an access pattern.');
      }
    });

    render('Select an access pattern.');
  }

  function initPublishLab(root) {
    const labels = ['write payload', 'release sequence', 'acquire sequence', 'read payload'];
    let stage = 0;
    let blocked = null;
    const container = root.querySelector('[data-publish-stages]');
    const log = root.querySelector('[data-publish-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      setStat('written', stage >= 1 ? 'yes' : 'no');
      setStat('released', stage >= 2 ? 1 : 0);
      setStat('acquired', stage >= 3 ? 1 : 0);
      setStat('safe', stage >= 3 ? 'yes' : 'no');
      container.replaceChildren();
      labels.forEach((label, index) => {
        const item = document.createElement('span');
        item.className = `ms-publish-stage${index < stage ? ' complete' : ''}${blocked === index ? ' blocked' : ''}`;
        item.textContent = label;
        container.append(item);
      });
      log.textContent = message;
      blocked = null;
    }

    function attempt(requiredStage, nextStage, success, failure) {
      if (stage === requiredStage) {
        stage = nextStage;
        render(success);
      } else {
        blocked = requiredStage;
        render(failure);
      }
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'write') attempt(0, 1, 'The producer initialized the payload, but has not published readiness.', 'This model already has a written payload; reset before producing another.');
      if (action === 'publish') attempt(1, 2, 'The release store published sequence 1 after payload initialization.', 'Release publication must follow payload construction.');
      if (action === 'acquire') attempt(2, 3, 'The consumer acquire observed sequence 1, establishing the synchronization edge.', 'The consumer cannot acquire the new sequence before it is published.');
      if (action === 'read') attempt(3, 4, 'The consumer may now read and move the initialized payload.', 'Reading before the acquire observes publication has no visibility proof.');
      if (action === 'reset') {
        stage = 0;
        blocked = null;
        render('The producer owns the empty slot.');
      }
    });

    render('The producer owns the empty slot.');
  }

  function initBenchmarkLab(root) {
    const labels = ['generate trace', 'build state', 'warm up', 'timed operations', 'checksum', 'report'];
    let timed = [];
    let observed = false;
    let samples = 0;
    let missing = null;
    let verdict = 'unconfigured';
    const container = root.querySelector('[data-benchmark-stages]');
    const log = root.querySelector('[data-benchmark-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      setStat('timed', timed.length);
      setStat('observed', observed ? 'yes' : 'no');
      setStat('samples', samples);
      setStat('verdict', verdict);
      container.replaceChildren();
      labels.forEach((label, index) => {
        const stage = document.createElement('span');
        stage.className = `ms-benchmark-stage${timed.includes(index) ? ' timed' : ''}${observed && index === 4 ? ' observed' : ''}${missing === index ? ' missing' : ''}`;
        stage.textContent = label;
        container.append(stage);
      });
      log.textContent = message;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      missing = null;
      if (action === 'clean') {
        timed = [3]; observed = true; samples = 50; verdict = 'usable';
        render('Setup and warmup are outside the declared operation boundary; repeated timed work feeds a verified checksum.');
      }
      if (action === 'setup') {
        timed = [1, 2, 3]; observed = true; samples = 50; verdict = 'different question';
        render('This can measure startup/component cost, but it cannot be labeled steady-state operation latency.');
      }
      if (action === 'dead') {
        timed = [3]; observed = false; samples = 50; missing = 4; verdict = 'invalid';
        render('Without an observable dependent result, the optimizer may remove or transform the work beyond recognition.');
      }
      if (action === 'oneshot') {
        timed = [3]; observed = true; samples = 1; verdict = 'insufficient';
        render('One sample cannot characterize variation or tail latency, even with a clean boundary.');
      }
      if (action === 'reset') {
        timed = []; observed = false; samples = 0; verdict = 'unconfigured';
        render('Select a boundary audit.');
      }
    });

    render('Select a boundary audit.');
  }

  function initBookLab(root) {
    const trace = [
      { type: 'add', id: 'B1', side: 'bid', price: 100, qty: 5 },
      { type: 'add', id: 'B2', side: 'bid', price: 100, qty: 3 },
      { type: 'add', id: 'S1', side: 'ask', price: 103, qty: 4 },
      { type: 'add', id: 'S2', side: 'ask', price: 101, qty: 2 },
      { type: 'add', id: 'B3', side: 'bid', price: 102, qty: 3 },
      { type: 'cancel', id: 'B1' },
      { type: 'modify', id: 'B2', qty: 1 },
      { type: 'add', id: 'S3', side: 'ask', price: 100, qty: 3 },
    ];
    let position;
    let orders;
    let levels;
    let tradeCount;
    const asksRoot = root.querySelector('[data-book-asks]');
    const bidsRoot = root.querySelector('[data-book-bids]');
    const log = root.querySelector('[data-book-log]');

    function resetState() {
      position = 0;
      orders = new Map();
      levels = { bid: new Map(), ask: new Map() };
      tradeCount = 0;
    }

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function sortedPrices(side) {
      return [...levels[side].keys()].sort((a, b) => side === 'bid' ? b - a : a - b);
    }

    function renderSide(rootElement, side) {
      rootElement.replaceChildren();
      const prices = sortedPrices(side);
      if (!prices.length) {
        const empty = document.createElement('p');
        empty.className = 'ms-book-empty';
        empty.textContent = 'empty';
        rootElement.append(empty);
        return;
      }
      prices.forEach((price) => {
        const ids = levels[side].get(price);
        const row = document.createElement('div');
        row.className = `ms-book-level ${side}`;
        const priceCell = document.createElement('strong');
        priceCell.textContent = String(price);
        const queue = document.createElement('span');
        queue.textContent = ids.map((id) => `${id}:${orders.get(id).qty}`).join(' -> ');
        const total = document.createElement('b');
        total.textContent = `Σ${ids.reduce((sum, id) => sum + orders.get(id).qty, 0)}`;
        row.append(priceCell, queue, total);
        rootElement.append(row);
      });
    }

    function render(message) {
      renderSide(asksRoot, 'ask');
      renderSide(bidsRoot, 'bid');
      const bestBid = sortedPrices('bid')[0] ?? '—';
      const bestAsk = sortedPrices('ask')[0] ?? '—';
      setStat('position', `${position} / ${trace.length}`);
      setStat('live', orders.size);
      setStat('bbo', `${bestBid} / ${bestAsk}`);
      setStat('trades', tradeCount);
      log.textContent = message;
    }

    function removeOrder(id) {
      const order = orders.get(id);
      if (!order) return false;
      const queue = levels[order.side].get(order.price);
      const index = queue.indexOf(id);
      if (index >= 0) queue.splice(index, 1);
      if (!queue.length) levels[order.side].delete(order.price);
      orders.delete(id);
      return true;
    }

    function rest(order) {
      if (!levels[order.side].has(order.price)) levels[order.side].set(order.price, []);
      levels[order.side].get(order.price).push(order.id);
      orders.set(order.id, order);
    }

    function add(input) {
      const incoming = { ...input };
      const opposite = incoming.side === 'bid' ? 'ask' : 'bid';
      const fills = [];
      while (incoming.qty > 0) {
        const bestPrice = sortedPrices(opposite)[0];
        if (bestPrice === undefined) break;
        const crosses = incoming.side === 'bid' ? incoming.price >= bestPrice : incoming.price <= bestPrice;
        if (!crosses) break;
        const makerId = levels[opposite].get(bestPrice)[0];
        const maker = orders.get(makerId);
        const quantity = Math.min(incoming.qty, maker.qty);
        incoming.qty -= quantity;
        maker.qty -= quantity;
        tradeCount += 1;
        fills.push(`${incoming.id}×${makerId} ${quantity}@${bestPrice}`);
        if (maker.qty === 0) removeOrder(makerId);
      }
      if (incoming.qty > 0) rest(incoming);
      return fills.length ? `Trades: ${fills.join('; ')}.${incoming.qty ? ` ${incoming.id} rests with ${incoming.qty}.` : ''}` : `Added ${incoming.id}: ${incoming.qty}@${incoming.price} ${incoming.side}.`;
    }

    function applyNext() {
      if (position >= trace.length) return 'The trace is complete.';
      const operation = trace[position];
      position += 1;
      if (operation.type === 'add') return add(operation);
      if (operation.type === 'cancel') {
        const removed = removeOrder(operation.id);
        return removed ? `Cancelled ${operation.id}; ID, FIFO, aggregate, and possibly its level changed.` : `Cancel ${operation.id} was absent.`;
      }
      const order = orders.get(operation.id);
      if (!order) return `Modify ${operation.id} was absent.`;
      const old = order.qty;
      order.qty = operation.qty;
      return `Reduced ${operation.id} from ${old} to ${operation.qty}; FIFO position stayed unchanged.`;
    }

    function validate() {
      const seen = new Set();
      let error = null;
      ['bid', 'ask'].forEach((side) => {
        levels[side].forEach((ids, price) => {
          if (!ids.length) error = `empty ${side} level ${price}`;
          ids.forEach((id) => {
            const order = orders.get(id);
            if (!order || order.side !== side || order.price !== price || order.qty <= 0) error = `bad queue entry ${id}`;
            if (seen.has(id)) error = `duplicate queue entry ${id}`;
            seen.add(id);
          });
        });
      });
      if (seen.size !== orders.size) error = 'ID index and queues have different live sets';
      const bid = sortedPrices('bid')[0];
      const ask = sortedPrices('ask')[0];
      if (bid !== undefined && ask !== undefined && bid >= ask) error = 'book remains crossed';
      return error ? `Invariant failure: ${error}.` : `Valid: ${orders.size} live orders appear exactly once, levels are nonempty, and the book is uncrossed.`;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'step') render(applyNext());
      if (action === 'run') {
        let message = 'The trace is complete.';
        while (position < trace.length) message = applyNext();
        render(message);
      }
      if (action === 'validate') render(validate());
      if (action === 'reset') {
        resetState();
        render('The book is empty.');
      }
    });

    resetState();
    render('The book is empty.');
  }

  function initCapstoneLab(root) {
    const gates = [
      ['semantics', 'versioned contract'],
      ['correctness', 'oracle + invariants'],
      ['workload', 'trace defense'],
      ['measurement', 'reproducible evidence'],
      ['defense', 'adversarial review'],
    ];
    const complete = new Set();
    const container = root.querySelector('[data-capstone-gates]');
    const log = root.querySelector('[data-capstone-log]');

    function setStat(name, value) {
      const element = root.querySelector(`[data-stat="${name}"]`);
      if (element) element.textContent = String(value);
    }

    function render(message) {
      const next = gates.find(([name]) => !complete.has(name));
      setStat('passed', `${complete.size} / ${gates.length}`);
      setStat('next', next ? next[0] : 'none');
      const benchmarkReady = ['semantics', 'correctness', 'workload'].every((name) => complete.has(name));
      setStat('ready', benchmarkReady ? 'yes' : 'no');
      setStat('status', complete.size === gates.length ? 'defended' : complete.size ? 'in progress' : 'not started');
      container.replaceChildren();
      gates.forEach(([name, description]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.gate = name;
        button.className = `ms-capstone-gate${complete.has(name) ? ' complete' : ''}${next && next[0] === name ? ' next' : ''}`;
        button.textContent = `${name}: ${description}`;
        container.append(button);
      });
      log.textContent = message;
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-gate]');
      if (!button) return;
      const name = button.dataset.gate;
      if (complete.has(name)) {
        complete.delete(name);
        render(`Reopened the ${name} gate; downstream conclusions may need review.`);
      } else {
        complete.add(name);
        render(`Marked ${name} complete. Only do this when the corresponding artifact exists.`);
      }
    });

    render('Start by versioning the semantic contract and trace schema.');
  }

  function initialize() {
    document.querySelectorAll('[data-ms-vector]').forEach(initVectorLab);
    document.querySelectorAll('[data-ms-list]').forEach(initListLab);
    document.querySelectorAll('[data-ms-ring]').forEach(initRingLab);
    document.querySelectorAll('[data-ms-array]').forEach(initArrayLab);
    document.querySelectorAll('[data-ms-stack]').forEach(initStackLab);
    document.querySelectorAll('[data-ms-heap]').forEach(initHeapLab);
    document.querySelectorAll('[data-ms-hash]').forEach(initHashLab);
    document.querySelectorAll('[data-ms-ordered]').forEach(initOrderedLab);
    document.querySelectorAll('[data-ms-trie]').forEach(initTrieLab);
    document.querySelectorAll('[data-ms-graph]').forEach(initGraphLab);
    document.querySelectorAll('[data-ms-bitmap]').forEach(initBitmapLab);
    document.querySelectorAll('[data-ms-range]').forEach(initRangeLab);
    document.querySelectorAll('[data-ms-cache]').forEach(initCacheLab);
    document.querySelectorAll('[data-ms-pool]').forEach(initPoolLab);
    document.querySelectorAll('[data-ms-layout-lab]').forEach(initLayoutLab);
    document.querySelectorAll('[data-ms-publish]').forEach(initPublishLab);
    document.querySelectorAll('[data-ms-benchmark]').forEach(initBenchmarkLab);
    document.querySelectorAll('[data-ms-book]').forEach(initBookLab);
    document.querySelectorAll('[data-ms-capstone]').forEach(initCapstoneLab);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
