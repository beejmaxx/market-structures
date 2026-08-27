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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
